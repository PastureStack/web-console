import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
const reviewSource = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
const {resourceReviewLabels} = await import(`data:text/javascript;base64,${Buffer.from(reviewSource).toString('base64')}`);

// Exercise the browser-owned modules loaded by the stdio bridge. No SDK,
// server, credentials or native lifecycle is used by this closed transport.
function fixture(transportKind = 'browser', state = 'active') {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, planSequence = 0, dispatches = 0, current;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], plans = new Map(), faults = {};
  const stack = {id: 'st1', type: 'stack', accountId: 'p1', name: 'Blue', state};
  const services = [
    {id: 'source', type: 'service', accountId: 'p1', name: 'app', stackId: 'st1', stackName: 'Blue', parentResolution: 'resolved', state},
    {id: 'blue-db', type: 'service', accountId: 'p1', name: 'db', stackId: 'st1', stackName: 'Blue', parentResolution: 'resolved', state: 'inactive'},
    {id: 'green-db', type: 'service', accountId: 'p1', name: 'db', stackId: 'st2', stackName: 'Green', parentResolution: 'resolved', state: 'active'},
  ];
  const graph = {subset: 'ordinary-service-links', completeness: 'unknown', permissionCompleteness: 'unknown', nodeLimit: 32, edgeLimit: 32, limitReached: false,
    nodes: services.slice(0, 2).map(({id, type, accountId, name, state}) => ({id, type, accountId, name, state, nameTruncated: false})),
    edges: [{sourceId: 'source', targetId: 'blue-db', relationship: 'service-link'}]};
  const engine = new CommandEngine({context, transportKind, wait: async () => {}, ensureSession: async () => {},
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async request => {
      requests.push(request);
      if (/^projects\/p1\/stacks\?limit=/.test(request.url)) return {body: {data: [stack]}};
      if (request.url === 'projects/p1/stacks/st1') return {body: stack};
      if (request.url === 'projects/p1/aiResourceViews') {
        const {resourceType, resourceId, view} = request.data;
        const rows = resourceType === 'stack' ? [{...stack, ...(view ? {stackGraph: graph} : {})}] : services;
        return {body: {resourceType, data: resourceId ? rows.filter(row => row.id === resourceId) : rows}};
      }
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (faults.unsupported) throw {status: 422, body: {code: 'ResourceChangeUnsupported', secret: 'PRIVATE_NATIVE_LINKS'}};
        const {resourceType, resourceId, operation, parameters} = request.data;
        const id = `aichange-00000000-0000-0000-0000-${String(++planSequence).padStart(12, '0')}`;
        const after = parameters.serviceIds.map(id => id === 'green-db' ? 'Green / db' : id.startsWith('db-') ? `Blue / ${id}` : 'Blue / db');
        current = {id, resourceType, resourceId, operation, targetPath: 'Environment / Blue / app',
          changes: [{field: 'targetServices', before: '["Blue / db"]', after: JSON.stringify(after)}],
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2030-01-01T00:00:00Z'};
        if (faults.plan) faults.plan(current);
        plans.set(id, current); return {body: structuredClone(current)};
      }
      const id = request.url.split('/').at(-1).split('?')[0], plan = plans.get(id);
      if (!plan) throw new Error('Unexpected closed Service-link test route');
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: structuredClone(plan)}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: structuredClone(plan)};
      }
      return {body: structuredClone(plan)};
    }});
  const ref = (id, resourceType = 'service', family = 'service', scope = 'project') =>
    context.reference('resource', {id, family, resourceType, scope}, context.capture());
  return {snapshot, context, engine, requests, graph, faults, services, ref, plan: () => current, dispatches: () => dispatches};
}

test('Service links extend the existing twelve tools and only the ordinary Service operation schema', async () => {
  assert.equal(COMMANDS.length, 12);
  const command = COMMANDS.find(row => row.name === 'preview_resource_change');
  assert.ok(command.inputSchema.properties.operation.enum.includes('update_links'));
  const condition = command.inputSchema.allOf.find(row => row.if.properties.operation?.const === 'update_links');
  assert.equal(condition.then.properties.resourceType.const, 'service');
  assert.deepEqual(condition.then.properties.parameters.required, ['serviceRefs']);
  assert.deepEqual(Object.keys(condition.then.properties.parameters.properties), ['serviceRefs']);
  assert.deepEqual(COMMANDS.find(row => row.name === 'get_resource').inputSchema.properties.view.enum, ['stack_graph', 'container_logs']);
  assert.match(command.description, /completeness remains unknown/);
  assert.match(command.description, /Active\/inactive state is preserved/);
  const f = fixture('stdio'), capabilities = await f.engine.execute('list_capabilities', {});
  const resources = capabilities.families.flatMap(row => row.resources);
  assert.ok(resources.find(row => row.resourceType === 'service').operations.includes('update_links'));
  for (const type of ['dnsService', 'externalService', 'loadBalancerService', 'container', 'stack'])
    assert.equal(resources.find(row => row.resourceType === type).operations.includes('update_links'), false);
});

for (const transportKind of ['browser', 'stdio']) {
  test(`${transportKind} Service links select exact same-name Stack refs, preserve unknown graph and require approval plus verified completion`, async () => {
    for (const state of ['active', 'inactive']) {
      const f = fixture(transportKind, state);
      const stacks = await f.engine.execute('find_resources', {family: 'stack'});
      const detail = await f.engine.execute('get_resource', {resourceRef: stacks.items[0].resourceRef, view: 'stack_graph'});
      assert.equal(detail.status, 'succeeded'); assert.equal(detail.graph.completeness, 'unknown');
      const source = detail.graph.nodes.find(row => row.name === 'app').resourceRef;
      const found = await f.engine.execute('find_resources', {family: 'service', resourceType: 'service', query: 'db'});
      const dbs = found.items.filter(row => row.fields.name === 'db');
      assert.equal(dbs.length, 2); assert.notEqual(dbs[0].resourceRef, dbs[1].resourceRef);
      const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: source,
        parameters: {serviceRefs: [dbs[1].resourceRef]}});
      assert.equal(preview.status, 'needs_user');
      assert.deepEqual(f.requests.at(-1).data, {resourceType: 'service', operation: 'update_links', parameters: {serviceIds: ['green-db']}, resourceId: 'source'});
      assert.deepEqual(preview.displayDiff, [{field: 'targetServices', before: '["Blue / db"]', after: '["Green / db"]'}]);
      assert.equal(JSON.stringify(preview).includes('green-db'), false);
      assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER'); assert.equal(f.dispatches(), 0);
      assert.equal((await f.engine.confirmPlan(preview.planRef)).status, 'succeeded');
      const applied = await f.engine.execute('apply_resource_change', {planRef: preview.planRef}); assert.equal(applied.status, 'accepted');
      f.plan().status = 'succeeded';
      assert.equal((await f.engine.execute('get_operation', {operationRef: applied.operationRef})).status, 'unknown');
      f.plan().verifiedResult = true;
      assert.equal((await f.engine.execute('get_operation', {operationRef: applied.operationRef})).status, 'succeeded');
      assert.equal(f.services[0].state, state); assert.equal(f.dispatches(), 1);
      assert.equal(detail.graph.completeness, 'unknown'); assert.equal(detail.graph.permissionCompleteness, 'unknown');
    }
  });

  test(`${transportKind} Service links accept an explicit empty replacement without using a graph as a write oracle`, async () => {
    const f = fixture(transportKind), source = f.ref('source');
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: source, parameters: {serviceRefs: []}});
    assert.equal(result.status, 'needs_user'); assert.equal(result.displayDiff[0].before, '["Blue / db"]'); assert.equal(result.displayDiff[0].after, '[]');
    assert.equal(f.requests.length, 1); assert.deepEqual(f.requests[0].data.parameters, {serviceIds: []});
    const ids = Array.from({length: 16}, (_, i) => 'db-' + i);
    const full = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: source, parameters: {serviceRefs: ids.map(id => f.ref(id))}});
    assert.equal(full.status, 'needs_user'); assert.deepEqual(f.requests.at(-1).data.parameters.serviceIds, ids);
    assert.deepEqual(JSON.parse(full.displayDiff[0].after), ids.map(id => 'Blue / ' + id));
  });

  test(`${transportKind} Service links reject raw legacy wrong-kind duplicate self and oversized refs before any backend call`, async () => {
    const f = fixture(transportKind), source = f.ref('source'), target = f.ref('blue-db'), sameId = f.ref('blue-db');
    const legacy = f.context.reference('service', {id: 'blue-db'}, f.context.capture());
    const kinds = ['dnsService', 'externalService', 'loadBalancerService', 'container'].map(type => f.ref(type, type, type === 'container' ? 'container' : 'service'));
    const otherFamily = f.ref('foreign', 'service', 'host'), global = f.ref('global', 'service', 'service', 'global');
    const base = {resourceType: 'service', operation: 'update_links', targetRef: source};
    const parameters = [undefined, {}, {serviceRefs: null}, {serviceRefs: ['blue-db']}, {serviceRefs: [legacy]}, {serviceRefs: [target, target]},
      {serviceRefs: [target, sameId]}, {serviceRefs: [source]}, {serviceRefs: Array.from({length: 17}, (_, i) => f.ref('db-' + i))},
      ...[...kinds, otherFamily, global].map(ref => ({serviceRefs: [ref]})), {serviceIds: ['blue-db']}, {serviceLinks: [{serviceId: 'blue-db'}]},
      {serviceRefs: [target], name: 'alias'}, {serviceRefs: [target], ports: ['80/tcp']}, {serviceRefs: [{serviceRef: target, name: 'named'}]}];
    for (const input of parameters) {
      const result = await f.engine.execute('preview_resource_change', {...base, parameters: input});
      assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code), JSON.stringify(result));
    }
    for (const targetRef of ['source', legacy, ...kinds, otherFamily, global]) {
      const result = await f.engine.execute('preview_resource_change', {...base, targetRef, parameters: {serviceRefs: [target]}});
      assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code));
    }
    assert.equal(f.requests.length, 0);
  });

  test(`${transportKind} Service links invalidate source and target refs on environment or session change`, async () => {
    for (const change of [snapshot => { snapshot.generation = 'g2'; }, snapshot => { snapshot.projectId = snapshot.schemaProjectId = 'p2'; }]) {
      const f = fixture(transportKind), source = f.ref('source'), target = f.ref('blue-db'); change(f.snapshot);
      const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: source, parameters: {serviceRefs: [target]}});
      assert.equal(result.code, 'STALE_REFERENCE'); assert.equal(f.requests.length, 0);
      const freshSource = f.ref('source');
      assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: freshSource, parameters: {serviceRefs: [target]}})).code, 'STALE_REFERENCE');
      assert.equal(f.requests.length, 0);
    }
  });
}

test('Service link review rejects incomplete malformed or mixed backend changes instead of rendering a partial plan', async () => {
  const mutations = [plan => { plan.changes = []; }, plan => { plan.changes[0].before = null; }, plan => { plan.changes[0].after = null; },
    plan => { plan.changes[0].after = '{}'; }, plan => { plan.changes[0].before = '[{"id":"PRIVATE_ID"}]'; },
    plan => { plan.changes[0].after = JSON.stringify(Array(17).fill('Stack / db')); }, plan => { plan.changes[0].after = JSON.stringify(['x'.repeat(769)]); },
    plan => { plan.changes.push({...plan.changes[0]}); }, plan => { plan.changes.push({field: 'state', before: 'inactive', after: 'active'}); },
    plan => { plan.changes[0].field = 'description'; }, plan => { plan.changes[0].after = '[]'; }, plan => { plan.resourceType = 'dnsService'; }];
  for (const mutation of mutations) {
    const f = fixture(); f.faults.plan = mutation;
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: f.ref('source'), parameters: {serviceRefs: [f.ref('green-db')]}});
    assert.equal(result.code, 'INVALID_RESPONSE'); assert.equal(result.planRef, undefined); assert.equal(f.dispatches(), 0);
    assert.equal(JSON.stringify(result).includes('PRIVATE_ID'), false);
  }
});

test('Service link confirmation rejects changed complete before or after review paths', async () => {
  for (const field of ['before', 'after']) {
    const f = fixture(), preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: f.ref('source'), parameters: {serviceRefs: [f.ref('green-db')]}});
    f.plan().changes[0][field] = '["Other Stack / db"]';
    assert.equal((await f.engine.confirmPlan(preview.planRef)).code, 'CONFLICT'); assert.equal(f.dispatches(), 0);
  }
});

test('Unsupported named port-qualified remote or incomplete before links stay backend-denied without fallback or Graph inference', async () => {
  for (const reason of ['named', 'port-qualified', 'remote', 'incomplete-before']) {
    const f = fixture(); f.faults.unsupported = reason;
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_links', targetRef: f.ref('source'), parameters: {serviceRefs: []}});
    assert.equal(result.code, 'UNAVAILABLE'); assert.equal(result.planRef, undefined); assert.match(result.nextStep, /incomplete existing links are unsupported/);
    assert.match(result.nextStep, /do not drop settings/); assert.equal(JSON.stringify(result).includes('PRIVATE_NATIVE_LINKS'), false);
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, 'projects/p1/aiResourceChangePlans'); assert.equal(f.dispatches(), 0);
  }
});

test('Service link review reuses the existing Links label in thirteen locales without changing exact target arrays or Alias labels', () => {
  const plan = {resourceType: 'service', operation: 'update_links', displayDiff: [{field: 'targetServices', before: '["Blue / db"]', after: '["Green / db"]'}]};
  const before = JSON.stringify(plan);
  for (const locale of ['en-us', 'zh-tw', 'zh-hans', 'de-de', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua']) {
    const source = readFileSync(new URL(`../translations/${locale}.yaml`, import.meta.url), 'utf8');
    const section = source.match(/^servicePage:\r?\n((?:[ \t].*\r?\n|\r?\n)*)/m)?.[1];
    const label = section?.match(/^  linksTab:\r?\n    header: (.+)$/m)?.[1]; assert.ok(label?.trim(), locale);
    const translated = resourceReviewLabels(plan, key => key === 'servicePage.linksTab.header' ? label : key);
    assert.equal(translated.operationLabel, label); assert.equal(translated.displayChanges[0].before, plan.displayDiff[0].before);
    assert.equal(translated.displayChanges[0].after, plan.displayDiff[0].after); assert.equal(translated.displayChanges[0].fieldLabel, 'formTarget.target');
  }
  assert.equal(JSON.stringify(plan), before);
  assert.equal(resourceReviewLabels({resourceType: 'dnsService', operation: 'update_targets'}, key => key).operationLabel, 'formTarget.target');
});
