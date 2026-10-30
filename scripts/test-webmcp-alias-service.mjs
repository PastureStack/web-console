import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

function fixture(aliasTargets = {}) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, nextId = 0, dispatches = 0, current;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], plans = new Map();
  const engine = new CommandEngine({context, transportKind: 'stdio', wait: async () => {}, ensureSession: async () => {},
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') {
        const type = request.data.resourceType;
        return {body: {resourceType: type, data: type === 'stack' ? [{id: 'st1', name: 'Blue'}, {id: 'st2', name: 'Green'}]
          : type === 'dnsService' ? [{id: 'dns', name: 'alias', stackId: 'st1', stackName: 'Blue', parentResolution: 'resolved', state: 'inactive', ...aliasTargets}]
            : [{id: 's1', name: 'db', stackId: 'st1', stackName: 'Blue', parentResolution: 'resolved'},
              {id: 's2', name: 'db', stackId: 'st2', stackName: 'Green', parentResolution: 'resolved'}]}};
      }
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        const {resourceType, resourceId, operation, parameters} = request.data;
        const id = `aichange-00000000-0000-0000-0000-${String(++nextId).padStart(12, '0')}`;
        const changes = operation === 'create' ? [{field: 'name', before: null, after: parameters.name},
          {field: 'targetServices', before: null, after: '[]'}, {field: 'startOnCreate', before: null, after: false}]
          : operation === 'update_targets' ? [{field: 'targetServices', before: '[]', after: JSON.stringify(parameters.serviceIds.map(id => id === 's2' ? 'Green / db' : 'Blue / db'))}]
            : [{field: 'state', before: 'inactive', after: 'active'}];
        current = {id, resourceType, operation, resourceId: resourceId || null, targetPath: 'Environment / Blue / alias', changes,
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2030-01-01T00:00:00Z'};
        plans.set(id, current); return {body: {...current}};
      }
      const id = request.url.split('/').at(-1).split('?')[0], plan = plans.get(id);
      if (!plan) throw new Error('Unexpected closed test transport');
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: {...plan}};
      }
      return {body: {...plan}};
    }});
  return {snapshot, context, engine, requests, plan: () => current, dispatches: () => dispatches};
}

test('Alias create is explicitly only stage one, then exact same-name serviceRef binding needs another approval', async () => {
  const f = fixture();
  const capability = (await f.engine.execute('list_capabilities', {})).families.find(family => family.family === 'service').resources.find(item => item.resourceType === 'dnsService');
  assert.deepEqual(capability.workflow, ['create', 'update_targets', 'optional_start']); assert.match(capability.workflowNotice, /no targets are bound/);
  const stacks = await f.engine.execute('find_resources', {family: 'stack'});
  const create = await f.engine.execute('preview_resource_change', {resourceType: 'dnsService', operation: 'create', parentRef: stacks.items[0].resourceRef, parameters: {name: 'alias'}});
  assert.equal(create.status, 'needs_user'); assert.equal(create.targetsBound, false); assert.match(create.nextStep, /update_targets/);
  assert.deepEqual(f.requests.at(-1).data.parameters, {name: 'alias', stackId: 'st1'});
  await f.engine.confirmPlan(create.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: create.planRef});
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const created = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(created.status, 'succeeded'); assert.equal(created.targetsBound, false); assert.match(created.nextStep, /update_targets/);
  const aliases = await f.engine.execute('find_resources', {family: 'service', resourceType: 'dnsService', query: 'alias'});
  const services = await f.engine.execute('find_resources', {family: 'service', resourceType: 'service', query: 'db'});
  assert.equal(services.items.length, 2); assert.notEqual(services.items[0].resourceRef, services.items[1].resourceRef);
  const links = await f.engine.execute('preview_resource_change', {resourceType: 'dnsService', operation: 'update_targets', targetRef: aliases.items[0].resourceRef,
    parameters: {serviceRefs: [services.items[1].resourceRef]}});
  assert.equal(links.status, 'needs_user'); assert.deepEqual(f.requests.at(-1).data.parameters, {serviceIds: ['s2']});
  assert.equal(links.displayDiff[0].after, '["Green / db"]'); assert.equal(JSON.stringify(links).includes('s2'), false);
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: links.planRef})).code, 'NEEDS_USER'); assert.equal(f.dispatches(), 1);
  await f.engine.confirmPlan(links.planRef); await f.engine.execute('apply_resource_change', {planRef: links.planRef}); assert.equal(f.dispatches(), 2);
});

test('Alias targets reject raw, duplicate, foreign-family, self and stale references; empty explicitly clears', async () => {
  const f = fixture(), captured = f.context.capture();
  const alias = f.context.reference('resource', {id: 'dns', family: 'service', resourceType: 'dnsService', scope: 'project'}, captured);
  const service = f.context.reference('resource', {id: 's1', family: 'service', resourceType: 'service', scope: 'project'}, captured);
  const duplicate = f.context.reference('service', {id: 's1'}, captured);
  const host = f.context.reference('resource', {id: 'h1', family: 'host', resourceType: 'host', scope: 'project'}, captured);
  const base = {resourceType: 'dnsService', operation: 'update_targets', targetRef: alias};
  for (const serviceRefs of [['s1'], [service, duplicate], [host], [alias], Array(17).fill(service)]) {
    const result = await f.engine.execute('preview_resource_change', {...base, parameters: {serviceRefs}});
    assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code));
  }
  assert.equal(f.requests.length, 0);
  assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters: {serviceRefs: []}})).status, 'needs_user');
  assert.deepEqual(f.requests.at(-1).data.parameters, {serviceIds: []});
  f.snapshot.generation = 'g2';
  assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters: {serviceRefs: [service]}})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, 1);
});

test('Alias review validates safe target arrays and reuses localized target labels without changing Catalog Archive or External', async () => {
  const f = fixture();
  const plan = {id: 'aichange-00000000-0000-0000-0000-000000000001', resourceType: 'dnsService', operation: 'update_targets', confirmationState: 'pending', targetPath: 'Environment / Alias',
    expiresAt: '2030-01-01T00:00:00Z', changes: [{field: 'targetServices', before: '[]', after: '["Stack / db"]'}]};
  assert.equal(f.engine.resourcePlanSummary(plan, 'opaque').displayDiff[0].after, '["Stack / db"]');
  for (const after of ['{}', '[{"id":"PRIVATE"}]', '[null]', JSON.stringify(Array(17).fill('db')), JSON.stringify(['a'.repeat(769)])])
    assert.throws(() => f.engine.resourcePlanSummary({...plan, changes: [{field: 'targetServices', before: '[]', after}]}, 'opaque'));
  const source = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
  const {resourceReviewLabels} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const labels = resourceReviewLabels({resourceType: 'dnsService', operation: 'update_targets', displayDiff: plan.changes}, key => key);
  assert.equal(labels.resourceTypeLabel, 'servicePage.type.dnsservice'); assert.equal(labels.displayChanges[0].fieldLabel, 'formTarget.target');
  assert.equal(resourceReviewLabels({resourceType: 'dnsService', operation: 'create'}, key => key).createsStopped, true);
  assert.equal(resourceReviewLabels({resourceType: 'externalService', operation: 'create'}, key => key).createsStopped, true);
  assert.equal(resourceReviewLabels({resourceType: 'stack', operation: 'create_from_catalog'}, key => key).operationLabel, 'newCatalog.saveNew');
  assert.equal(resourceReviewLabels({resourceType: 'service', operation: 'restore'}, key => key).archiveNotices.length, 3);
});

test('Alias detail distinguishes empty resolved and hidden targets and rejects malformed summaries', async () => {
  for (const [summary, availability, hint] of [
    [{linkedServiceCount: 0, unresolvedTargetCount: 0, targetServices: '[]'}, 'resolved', /no targets/],
    [{linkedServiceCount: 1, unresolvedTargetCount: 0, targetServices: '["Green \/ db"]'}, 'resolved', /complete target names/],
    [{linkedServiceCount: 1, unresolvedTargetCount: 1, targetServices: '[]'}, 'partial', /No hidden target names or IDs/],
    [{}, 'unavailable', /not been resolved/],
  ]) {
    const f = fixture(summary), list = await f.engine.execute('find_resources', {family: 'service', resourceType: 'dnsService'});
    const detail = await f.engine.execute('get_resource', {resourceRef: list.items[0].resourceRef});
    assert.equal(detail.status, 'succeeded'); assert.equal(detail.targetBindings.availability, availability); assert.match(detail.nextStep, hint);
  }
  for (const summary of [{linkedServiceCount: 1, unresolvedTargetCount: 0, targetServices: '[]'},
    {linkedServiceCount: 1, unresolvedTargetCount: 0, targetServices: '[{"secret":"PRIVATE"}]'},
    {linkedServiceCount: -1, unresolvedTargetCount: 0, targetServices: '[]'}]) {
    const f = fixture(summary), list = await f.engine.execute('find_resources', {family: 'service', resourceType: 'dnsService'});
    const detail = await f.engine.execute('get_resource', {resourceRef: list.items[0].resourceRef});
    assert.equal(detail.code, 'INVALID_RESPONSE'); assert.equal(JSON.stringify(detail).includes('PRIVATE'), false);
  }
});
