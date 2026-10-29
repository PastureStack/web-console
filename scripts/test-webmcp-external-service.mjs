import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const planId = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture() {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan, dispatches = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [];
  const engine = new CommandEngine({context, wait: async () => {}, ensureSession: async () => {},
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async (request) => {
      requests.push(request);
      if (request.url.startsWith('projects/p1/stacks?')) return {body: {data: [{id: 'st1', name: 'Same'}, {id: 'st2', name: 'Same'}]}};
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'externalService', data: [{id: 'external2', accountId: 'p1', name: 'orders-db', stackId: 'st2', stackName: 'Same', hostname: 'db.example.test', externalIpAddresses: null}]}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id: planId, resourceType, operation, resourceId: resourceId || null, targetPath: 'Environment/Same/orders-db',
          changes: operation === 'create' ? [{field: 'name', before: null, after: parameters.name}, {field: 'hostname', before: null, after: parameters.hostname || null},
            {field: 'externalIpAddresses', before: null, after: parameters.externalIpAddresses ? JSON.stringify(parameters.externalIpAddresses) : null}, {field: 'startOnCreate', before: null, after: false}]
            : [{field: 'state', before: 'inactive', after: 'active'}],
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-10-30T12:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: {...plan}};
      }
      if (request.url.endsWith(planId)) return {body: {...plan}};
      throw Error('Unexpected fixed transport');
    }});
  return {snapshot, context, engine, requests, plan: () => plan, dispatches: () => dispatches};
}

test('external service: exact selected opaque Stack parent creates a stopped native intent', async () => {
  const f = fixture();
  const stacks = await f.engine.execute('find_resources', {family: 'stack', query: 'Same'});
  assert.equal(stacks.items.length, 2); assert.notEqual(stacks.items[0].resourceRef, stacks.items[1].resourceRef);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'externalService', operation: 'create',
    parentRef: stacks.items[1].resourceRef, parameters: {name: 'orders-db', hostname: 'db.example.test'}});
  assert.equal(preview.status, 'needs_user');
  assert.equal(f.requests.at(-1).data.parameters.stackId, 'st2');
  assert.equal(Object.hasOwn(f.requests.at(-1).data.parameters, 'image'), false);
  assert.equal(JSON.stringify(preview).includes('st2'), false); assert.equal(JSON.stringify(preview).includes(planId), false);
  assert.equal(preview.displayDiff.find(item => item.field === 'startOnCreate').after, false);
});

test('external service: URL, raw IDs, mixed modes, unsafe IPs and unknown configuration never dispatch', async () => {
  const f = fixture(); const captured = f.context.capture();
  const parentRef = f.context.reference('resource', {id: 'st2', family: 'stack', resourceType: 'stack', scope: 'project'}, captured);
  const base = {resourceType: 'externalService', operation: 'create', parentRef, parameters: {name: 'db', hostname: 'db.test'}};
  for (const delta of [{parentRef: 'st2'}, {parameters: {name: 'db'}}, {parameters: {...base.parameters, externalIpAddresses: ['192.0.2.1']}},
    {parameters: {...base.parameters, healthCheck: {url: 'PRIVATE'}}}, {parameters: {...base.parameters, stackId: 'other'}}]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...base, ...delta})).code, delta.parentRef === 'st2' ? 'STALE_REFERENCE' : 'INVALID_INPUT');
  }
  for (const hostname of ['https://db.test', 'user:PRIVATE@db.test', 'db:443', 'db/path', 'db?secret', '*.db', 'bad\nname']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters: {name: 'db', hostname}})).code, 'INVALID_INPUT');
  }
  for (const externalIpAddresses of [[], ['db.test'], ['256.1.1.1'], ['::1%eth0'], [':::1'], ['[::1]'], ['192.0.2.1:80'], ['192.0.2.1', '192.0.2.1']]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters: {name: 'db', externalIpAddresses}})).code, 'INVALID_INPUT');
  }
  assert.equal(f.requests.length, 0);
});

test('external service: current safe lookup -> separate approved activation -> verified operation, no raw mutation', async () => {
  const f = fixture();
  const found = await f.engine.execute('find_resources', {family: 'service', resourceType: 'externalService', query: 'orders-db'});
  assert.equal(found.items.length, 1);
  const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(detail.fields.hostname, 'db.example.test');
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'externalService', operation: 'start', targetRef: found.items[0].resourceRef});
  assert.equal(preview.status, 'needs_user');
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.dispatches(), 0); await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(accepted.status, 'accepted'); assert.equal(f.dispatches(), 1);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const observed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(observed.status, 'succeeded'); assert.equal(observed.verifiedResult, true); assert.equal(f.dispatches(), 1);
  assert.ok(f.requests.every(request => request.method !== 'PUT' && !request.url.includes('/externalServices')));
});

test('external service: exact bounded target summaries and stale actor refs fail closed', async () => {
  const f = fixture(); const parentRef = f.context.reference('resource', {id: 'st2', family: 'stack', resourceType: 'stack', scope: 'project'}, f.context.capture());
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'externalService', operation: 'create', parentRef,
    parameters: {name: 'db', externalIpAddresses: ['192.0.2.1', '2001:db8::1', '::ffff:192.0.2.1']}});
  assert.equal(preview.status, 'needs_user');
  for (const after of ['["https://PRIVATE@host"]', '[]', '[":::1"]', '{}', 'PRIVATE']) {
    assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), changes: [{field: 'externalIpAddresses', before: null, after}]}, 'ref'));
  }
  f.snapshot.generation = 'replacement';
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'STALE_REFERENCE');
  assert.equal(f.dispatches(), 0);
});

test('external service: human review labels describe actual type, target fields and stopped creation', async () => {
  const source = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
  const {resourceReviewLabels} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const labels = resourceReviewLabels({resourceType: 'externalService', operation: 'update_targets', displayDiff: [{field: 'hostname', before: null, after: 'db.test'},
    {field: 'externalIpAddresses', before: '["192.0.2.1"]', after: null}]}, key => key);
  assert.equal(labels.resourceTypeLabel, 'servicePage.type.externalservice'); assert.equal(labels.operationLabel, 'formTarget.target');
  assert.deepEqual(labels.displayChanges.map(item => item.fieldLabel), ['formTarget.pointHostname', 'formTarget.pointAddress']);
  assert.equal(resourceReviewLabels({resourceType: 'externalService', operation: 'create'}, key => key).createsStopped, true);
});

test('external service integration: endpoint editing and deletion retain Catalog Archive and the bound failed receipt', async () => {
  const registrySource = readFileSync(new URL('../app/utils/ai-resource-registry.js', import.meta.url), 'utf8');
  const {RESOURCE_CHANGES} = await import(`data:text/javascript;base64,${Buffer.from(registrySource).toString('base64')}`);
  assert.ok(RESOURCE_CHANGES.stack.create_from_catalog); assert.ok(RESOURCE_CHANGES.stack.archive);
  assert.ok(RESOURCE_CHANGES.service.restore);
  assert.ok(COMMANDS.find(item => item.name === 'preview_resource_change').inputSchema.properties.catalogVersionRef);
  const f = fixture(), original = f.engine.request;
  f.engine.request = async request => {
    const result = await original(request);
    if (request.url === 'projects/p1/aiResourceChangePlans') {
      const {operation, parameters} = request.data;
      f.plan().changes = operation === 'update_targets' ? [
        {field: 'hostname', before: 'db.example.test', after: parameters.hostname || null},
        {field: 'externalIpAddresses', before: null, after: parameters.externalIpAddresses ? JSON.stringify(parameters.externalIpAddresses) : null},
      ] : operation === 'update_metadata' ? [{field: 'description', before: null, after: parameters.description}]
        : operation === 'remove' ? [{field: 'affectedInstanceCount', before: 0, after: 0},
          {field: 'affectedMountCount', before: 0, after: null},
          {field: 'mountedDataRule', before: null, after: 'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'}]
          : [{field: 'state', before: 'active', after: 'inactive'}];
      return {body: {...f.plan()}};
    }
    return result;
  };
  const found = await f.engine.execute('find_resources', {family: 'service', resourceType: 'externalService', query: 'orders-db'});
  const targetRef = found.items[0].resourceRef;
  for (const [operation, parameters] of [['update_targets', {externalIpAddresses: ['192.0.2.1', '2001:db8::1']}],
    ['update_targets', {hostname: 'new.example.test'}], ['update_metadata', {description: ''}], ['remove', {}]]) {
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'externalService', operation, targetRef, parameters});
    assert.equal(preview.status, 'needs_user');
    assert.deepEqual(f.requests.at(-1).data, {resourceType: 'externalService', operation, resourceId: 'external2', parameters});
  }
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'externalService', operation: 'stop', targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  f.plan().status = 'failed'; f.plan().verifiedResult = false; f.plan().messageCode = 'ResourceChangeAuthorizationDenied';
  const failed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(failed.status, 'failed'); assert.equal(failed.code, 'FORBIDDEN');
  assert.equal(failed.partialEffectsPossible, true); assert.equal(failed.verifiedResult, false);
  assert.equal(failed.operationRef, accepted.operationRef); assert.equal(f.dispatches(), 1);
  assert.match(failed.nextStep, /Do not blindly resubmit/);
  const labelsSource = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
  const {resourceReviewLabels} = await import(`data:text/javascript;base64,${Buffer.from(labelsSource).toString('base64')}`);
  assert.equal(resourceReviewLabels({resourceType: 'service', operation: 'archive'}, key => key).archiveNotices.length, 3);
  assert.equal(resourceReviewLabels({resourceType: 'stack', operation: 'create_from_catalog'}, key => key).operationLabel, 'newCatalog.saveNew');
});
