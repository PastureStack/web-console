import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
import {allowedRequest} from '../bridge/core.mjs';
const id = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture({transportKind = 'browser', mode = 'enabled', mutate = x => x, rejected} = {}) {
  const snapshot = {generation: 'g', accountId: 'actor', projectId: 'p1', schemaProjectId: 'p1', schemaGeneration: 1, route: '/storagepools'};
  let sequence = 0, plan, writes = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode(mode);
  const calls = [], published = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, onPlan: x => published.push(x),
    audit: async () => ({accepted: true, requestId: 'audit'}), request: async request => {
      calls.push(request);
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (rejected) throw rejected;
        const p = request.data.parameters;
        plan = mutate({id, resourceType: 'volume', operation: 'create', resourceId: null, targetPath: 'Env / ' + p.name,
          confirmationState: 'pending', status: 'preview', verifiedResult: false, changes: [
            {field: 'name', before: null, after: p.name}, ...(Object.hasOwn(p, 'description') ? [{field: 'description', before: null, after: p.description}] : []), {field: 'driver', before: null, after: 'local'}, {field: 'state', before: null, after: 'inactive'}]});
        return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: structuredClone(plan)}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        writes++; return {body: {...structuredClone(plan), status: 'accepted'}};
      }
      return {body: structuredClone(plan)};
    }});
  return {context, engine, calls, published, snapshot, get plan() { return plan; }, get writes() { return writes; }};
}
const input = extra => ({resourceType: 'volume', operation: 'create', parameters: {name: 'new-data', ...extra}});
for (const transportKind of ['browser', 'stdio']) {
  test(transportKind + ' uses fixed local creation and existing human approval, without a raw Volume route', async () => {
    const f = fixture({transportKind}), preview = await f.engine.execute('preview_resource_change', input());
    assert.equal(preview.status, 'needs_user'); assert.equal(f.writes, 0); assert.deepEqual(f.calls[0].data, input());
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
    f.plan.confirmationState = 'approved';
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).status, 'accepted'); assert.equal(f.writes, 1);
    assert.equal(f.calls.some(row => row.method === 'PUT' || row.url.includes('/volumes')), false);
    assert.equal(COMMANDS.length, 12); assert.equal(allowedRequest('projects/p1/volumes', 'POST', 'p1'), false);
    assert.equal(allowedRequest('projects/p1/aiResourceChangePlans/' + id + '?action=confirm', 'POST', 'p1'), false);
  });
}
test('raw drivers IDs paths credentials image size and unsupported Volume actions fail before transport', async () => {
  for (const field of ['driver', 'driverOpts', 'hostId', 'storageDriverId', 'accountId', 'resourceId', 'path', 'uri', 'sizeMb', 'isHostPath', 'credentials', 'image']) {
    const f = fixture(); assert.equal((await f.engine.execute('preview_resource_change', input({[field]: 'PRIVATE'}))).code, 'INVALID_INPUT');
    assert.equal(f.calls.length, 0);
  }
  for (const name of ['../data', '/host/path', 'with space', 'local:///data', 'a'.repeat(64)]) {
    const f = fixture(); assert.equal((await f.engine.execute('preview_resource_change', input({name}))).code, 'INVALID_INPUT'); assert.equal(f.calls.length, 0);
  }
  for (const extra of [{targetRef: 'resource_old'}, {parentRef: 'resource_old'}, {operation: 'update_metadata'}, {resourceType: 'persistentVolume'}]) {
    const f = fixture(); assert.equal((await f.engine.execute('preview_resource_change', {...input(), ...extra})).code, 'INVALID_INPUT'); assert.equal(f.calls.length, 0);
  }
});
test('readonly and stale environment cannot create', async () => {
  const read = fixture({mode: 'read-only'}); assert.equal((await read.engine.execute('preview_resource_change', input())).code, 'UNAVAILABLE');
  assert.equal(read.calls.length, 0);
  const f = fixture(), p = await f.engine.execute('preview_resource_change', input()); f.snapshot.projectId = 'p2'; f.snapshot.schemaProjectId = 'p2';
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: p.planRef})).code, 'STALE_REFERENCE'); assert.equal(f.writes, 0);
});
test('missing rows plugin driver allocated state and old same-name result cannot become a review', async () => {
  for (const mutate of [
    p => ({...p, changes: p.changes.filter(x => x.field !== 'driver')}),
    p => ({...p, changes: p.changes.map(x => x.field === 'driver' ? {...x, after: 'plugin'} : x)}),
    p => ({...p, changes: p.changes.map(x => x.field === 'state' ? {...x, after: 'active'} : x)}),
    p => ({...p, changes: p.changes.map(x => x.field === 'name' ? {...x, after: 'old-same-name'} : x)}),
  ]) {
    const f = fixture({mutate}); assert.equal((await f.engine.execute('preview_resource_change', input())).code, 'INVALID_RESPONSE'); assert.equal(f.published.length, 0);
  }
});
test('only the native inactive create terminal is reviewable on browser and stdio', async () => {
  for (const transportKind of ['browser', 'stdio']) {
    const valid = fixture({transportKind});
    assert.equal((await valid.engine.execute('preview_resource_change', input())).status, 'needs_user');
    for (const state of ['requested', 'registering', 'creating', 'activating', 'active', 'detached', 'removing', 'removed', 'purged', 'error']) {
      const f = fixture({transportKind, mutate: p => ({...p, changes: p.changes.map(row => row.field === 'state' ? {...row, after: state} : row)})});
      assert.equal((await f.engine.execute('preview_resource_change', input())).code, 'INVALID_RESPONSE', state);
      assert.equal(f.published.length, 0); assert.equal(f.writes, 0);
    }
  }
});
test('review drift blocks both human confirmation and approved apply', async () => {
  const f = fixture(), p = await f.engine.execute('preview_resource_change', input()); f.plan.changes[0].after = 'old-same-name'; f.plan.confirmationState = 'approved';
  assert.equal((await f.engine.confirmPlan(p.planRef)).code, 'CONFLICT');
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: p.planRef})).code, 'CONFLICT'); assert.equal(f.writes, 0);
});
test('unsupported local scope gives human guidance and hides raw payload', async () => {
  const f = fixture({rejected: {status: 422, body: {code: 'ResourceChangeUnsupported', detail: 'PRIVATE'}}});
  const result = await f.engine.execute('preview_resource_change', input());
  assert.equal(result.code, 'UNAVAILABLE'); assert.match(result.nextStep, /human Volume UI/); assert.match(result.nextStep, /Names can repeat/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
});
test('closed advertised schema and fixed human notice describe only logical creation', async () => {
  const tool = COMMANDS.find(x => x.name === 'preview_resource_change');
  const branch = tool.inputSchema.allOf.find(row => row.if?.properties?.resourceType?.const === 'volume');
  assert.equal(branch.then.properties.operation.const, 'create'); assert.deepEqual(Object.keys(branch.then.properties.parameters.properties), ['name', 'description']);
  assert.equal(branch.then.properties.parameters.additionalProperties, false);
  const source = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
  const {resourceReviewLabels} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(resourceReviewLabels({resourceType: 'volume', operation: 'create'}, x => x).localVolumeCreateNotice, 'webmcp.localVolumeCreateNotice');
  assert.match(readFileSync(new URL('../app/components/modal-confirm-ai-upgrade/template.hbs', import.meta.url), 'utf8'), /data-testid="ai-volume-create-logical-only"/);
});

test('verified completion returns only the new opaque record and never promises Host storage', async () => {
  const f = fixture(), preview = await f.engine.execute('preview_resource_change', input({description: null}));
  assert.equal(preview.status, 'needs_user'); f.plan.confirmationState = 'approved';
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(accepted.verifiedResult, false); assert.equal(accepted.createdResource, undefined);
  f.plan.status = 'succeeded'; f.plan.verifiedResult = true; f.plan.resourceId = '1v91';
  const result = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(result.completionScope, 'unallocated-local-volume-record'); assert.equal(result.physicalStorageVerified, false); assert.equal(result.mountVerified, false);
  const reference = f.context.resolve(result.createdResource.resourceRef, 'resource', f.context.capture()); assert.equal(reference.id, '1v91');
  assert.equal(JSON.stringify(result).includes('1v91'), false); assert.match(result.nextStep, /names can repeat/);
});
