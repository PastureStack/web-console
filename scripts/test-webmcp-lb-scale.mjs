import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const id = 'aichange-11111111-1111-4111-8111-111111111111';
function fixture(transportKind = 'stdio', state = 'active') {
  const snapshot = {generation: 'g1', accountId: 'principal', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/service'};
  let sequence = 0, dispatches = 0, plan;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], audits = [], faults = {};
  const row = {id: 'lb-one', accountId: 'p1', name: 'shared', stackId: 'stack-one', stackName: 'Blue', state, scale: 1,
    data: {secret: 'PRIVATE-CANARY'}, lbConfig: {secret: 'PRIVATE-CANARY'}};
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'a' + audits.length}; }, request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'loadBalancerService', data: [row]}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (faults.preview) throw faults.preview;
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id, resourceType, operation, resourceId, targetPath: 'Environment / Blue / shared',
          changes: faults.changes || [{field: 'scale', before: row.scale, after: parameters.scale}],
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-06T00:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (faults.apply) throw faults.apply;
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: {...plan}};
      }
      if (request.url.endsWith(id)) return {body: {...plan}};
      throw Error('Unexpected fixed route');
    }});
  return {engine, context, snapshot, requests, audits, faults, row, plan: () => plan, dispatches: () => dispatches};
}

async function input(f, scale = 2) {
  const found = await f.engine.execute('find_resources', {family: 'load-balancer'});
  return {resourceType: 'loadBalancerService', operation: 'scale', targetRef: found.items[0].resourceRef, parameters: {scale}};
}

test('LB manual scale: shared browser and Bridge require human confirmation and preserve inactive state with typed readback', async () => {
  for (const transport of ['browser', 'stdio']) for (const state of ['active', 'inactive']) {
    const f = fixture(transport, state), request = await input(f);
    const preview = await f.engine.execute('preview_resource_change', request);
    assert.equal(preview.status, 'needs_user'); assert.deepEqual(preview.displayDiff, [{field: 'scale', before: 1, after: 2}]);
    assert.equal(f.dispatches(), 0);
    assert.deepEqual(f.requests.at(-1).data, {resourceType: 'loadBalancerService', operation: 'scale', resourceId: 'lb-one', parameters: {scale: 2}});
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
    await f.engine.confirmPlan(preview.planRef);
    const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef}); assert.equal(accepted.status, 'accepted');
    f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
    assert.equal((await f.engine.execute('get_operation', {operationRef: accepted.operationRef})).verifiedResult, true);
    assert.equal(f.row.state, state); assert.equal(f.dispatches(), 1);
    assert.ok(f.requests.every(value => value.method !== 'PUT' && !value.url.includes('/loadBalancerServices') && !value.url.includes('?action=activate')));
    assert.ok(f.audits.some(value => value.phase === 'result'));
    assert.equal(JSON.stringify(preview).includes('PRIVATE-CANARY'), false); assert.equal(JSON.stringify(preview).includes('lb-one'), false);
  }
});

test('LB manual scale: UI minimum and native int ceiling do not widen ordinary Service scale or accept configuration', async () => {
  const f = fixture(), value = await input(f);
  for (const scale of [0, -1, 1.5, 2147483648]) {
    const before = f.requests.length;
    assert.equal((await f.engine.execute('preview_resource_change', {...value, parameters: {scale}})).code, 'INVALID_INPUT');
    assert.equal(f.requests.length, before);
  }
  for (const field of ['lbConfig', 'portRules', 'ports', 'weights', 'launchConfig', 'startOnCreate', 'state']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...value, parameters: {scale: 2, [field]: 'PRIVATE-CANARY'}})).code, 'INVALID_INPUT');
  }
  for (const scale of [1, 101, 2147483647]) assert.equal((await f.engine.execute('preview_resource_change', {...value, parameters: {scale}})).status, 'needs_user');
  const before = f.requests.length;
  assert.equal((await f.engine.execute('preview_resource_change', {...value, resourceType: 'service', parameters: {scale: 101}})).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, before); assert.equal(f.dispatches(), 0);
});

test('LB manual scale: Global readonly Key revision and foreign context fail closed without native dispatch', async () => {
  for (const [status, code, expected] of [[422, 'ResourceChangeUnsupported', 'UNAVAILABLE'], [403, 'OwnerPermissionDenied', 'FORBIDDEN'],
    [403, 'KeyScopeDenied', 'FORBIDDEN'], [403, 'ApiKeyPolicyChanged', 'FORBIDDEN'], [404, 'NotFound', 'FORBIDDEN']]) {
    const f = fixture(), value = await input(f); f.faults.preview = {status, body: {code, message: 'PRIVATE-CANARY'}};
    const result = await f.engine.execute('preview_resource_change', value);
    assert.equal(result.code, expected); assert.equal(f.dispatches(), 0); assert.equal(JSON.stringify(result).includes('PRIVATE-CANARY'), false);
  }
  const f = fixture(), value = await input(f), before = f.requests.length;
  f.snapshot.projectId = f.snapshot.schemaProjectId = 'foreign';
  assert.equal((await f.engine.execute('preview_resource_change', value)).code, 'STALE_REFERENCE'); assert.equal(f.requests.length, before);
});

test('LB manual scale: altered review fields and a stale confirmed plan never become successful writes', async () => {
  for (const changes of [[{field: 'scale', before: 1, after: 3}], [{field: 'name', before: 'a', after: 'b'}],
    [{field: 'scale', before: 1, after: 2}, {field: 'description', before: '', after: 'PRIVATE-CANARY'}]]) {
    const f = fixture(), value = await input(f); f.faults.changes = changes;
    assert.equal((await f.engine.execute('preview_resource_change', value)).code, 'INVALID_RESPONSE'); assert.equal(f.dispatches(), 0);
  }
  const f = fixture(), value = await input(f), preview = await f.engine.execute('preview_resource_change', value);
  await f.engine.confirmPlan(preview.planRef); f.faults.apply = {status: 409, body: {code: 'ResourceChangePlanStale'}};
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'CONFLICT'); assert.equal(f.dispatches(), 0);
});
