import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';
import {readFileSync} from 'node:fs';
const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));

const id = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture() {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/hosts'};
  let sequence = 0, plan, dispatches = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const faults = {}, requests = [], rows = ['first', 'selected'].map(suffix => ({id: `host-${suffix}`, accountId: 'p1', name: 'same-name', description: suffix,
    state: 'active', hostname: `${suffix}.example.test`, info: {secret: 'PRIVATE-INFO-CANARY'}, credentials: 'PRIVATE-CREDENTIAL-CANARY', data: {key: 'PRIVATE-DATA-CANARY'}}));
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {}, wait: async () => {},
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'host',
        data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (faults.preview) { throw faults.preview; }
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id, resourceType, operation, resourceId, targetPath: 'Environment / same-name',
          changes: Object.entries(parameters).map(([field, after]) => ({field, before: field === 'name' ? 'same-name' : 'selected', after})),
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-01T00:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted';
        if (faults.apply) { throw faults.apply; }
        return {body: {...plan}};
      }
      if (request.url.endsWith(id)) return {body: {...plan}};
      throw Error('Unexpected fixed route');
    }});
  return {engine, context, snapshot, requests, rows, faults, plan: () => plan, dispatches: () => dispatches};
}

test('host: selected same-name opaque reference -> safe metadata -> human approved plan -> verified receipt', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'host', query: 'same-name'});
  assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
  const targetRef = found.items[1].resourceRef;
  const detail = await f.engine.execute('get_resource', {resourceRef: targetRef});
  assert.equal(detail.fields.hostname, 'selected.example.test'); assert.equal(JSON.stringify([found, detail]).includes('PRIVATE-'), false);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'host', operation: 'update_metadata', targetRef,
    parameters: {name: 'renamed', description: ''}});
  assert.equal(preview.status, 'needs_user'); assert.equal(f.requests.at(-1).data.resourceId, 'host-selected');
  assert.equal(JSON.stringify(preview).includes('host-selected'), false);
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.dispatches(), 0); await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(accepted.status, 'accepted'); assert.equal(f.dispatches(), 1);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const observed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(observed.status, 'succeeded'); assert.equal(observed.verifiedResult, true);
  assert.ok(f.requests.every(request => request.method !== 'PUT' && !request.url.includes('/hosts')));
});

test('host: infrastructure fields, raw IDs and unsupported intents never reach transport', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'host'});
  const input = {resourceType: 'host', operation: 'update_metadata', targetRef: found.items[0].resourceRef};
  const before = f.requests.length;
  for (const field of ['hostname', 'labels', 'info', 'data', 'credentials', 'accountId', 'uuid', 'state', 'memory', 'milliCpu']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {[field]: 'PRIVATE-CANARY'}})).code, 'INVALID_INPUT');
  }
  for (const operation of ['create', 'remove', 'start', 'stop', 'update_targets']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, operation, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  }
  assert.equal((await f.engine.execute('preview_resource_change', {...input, targetRef: 'host-first', parameters: {name: 'x'}})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, before);
});

test('host: project changes invalidate issued references before preview', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'host'});
  const before = f.requests.length; f.snapshot.projectId = 'foreign'; f.snapshot.schemaProjectId = 'foreign';
  const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'host', operation: 'update_metadata',
    targetRef: found.items[0].resourceRef, parameters: {name: 'new'}});
  assert.ok(['CONTEXT_CHANGED', 'STALE_REFERENCE'].includes(rejected.code)); assert.equal(f.requests.length, before);
});

test('host: capabilities, closed input enum and human review expose only metadata changes', async () => {
  const f = fixture(), capability = (await f.engine.execute('list_capabilities', {})).families.find(family => family.family === 'host').resources[0];
  assert.deepEqual(capability.operations, ['update_metadata']);
  const tool = COMMANDS.find(tool => tool.name === 'preview_resource_change');
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('host'));
  const labels = resourceReviewLabels({resourceType: 'host', operation: 'update_metadata', displayDiff: [{field: 'description', before: null, after: ''}]}, key => key);
  assert.equal(labels.resourceTypeLabel, 'apiKeyAccess.selector.types.host'); assert.equal(labels.operationLabel, 'generic.edit');
});

test('host: live denials remain rejected and a lost accepted response never repeats the mutation', async () => {
  for (const [status, code, expected] of [[403, 'PermissionDenied', 'FORBIDDEN'], [409, 'ResourceChangePlanStale', 'CONFLICT']]) {
    const f = fixture(), found = await f.engine.execute('find_resources', {family: 'host'});
    f.faults.preview = {status, body: {code, message: 'PRIVATE-ERROR-CANARY'}};
    const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'host', operation: 'update_metadata',
      targetRef: found.items[0].resourceRef, parameters: {description: ''}});
    assert.equal(rejected.status, 'rejected'); assert.equal(rejected.code, expected);
    assert.equal(JSON.stringify(rejected).includes('PRIVATE-'), false); assert.equal(f.dispatches(), 0);
  }
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'host'});
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'host', operation: 'update_metadata',
    targetRef: found.items[1].resourceRef, parameters: {description: null}});
  assert.equal(f.requests.at(-1).data.parameters.description, null);
  await f.engine.confirmPlan(preview.planRef); f.faults.apply = Error('PRIVATE-TRANSPORT-CANARY');
  const uncertain = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(uncertain.status, 'unknown'); assert.ok(uncertain.operationRef); assert.equal(f.dispatches(), 1);
  assert.equal(JSON.stringify(uncertain).includes('PRIVATE-'), false);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const recovered = await f.engine.execute('get_operation', {operationRef: uncertain.operationRef});
  assert.equal(recovered.status, 'succeeded'); assert.equal(recovered.verifiedResult, true);
  assert.equal(f.dispatches(), 1);
  assert.equal(f.requests.filter(request => request.url.endsWith('?action=apply')).length, 1);
});

test('host and certificate: machine guidance names the exact metadata subset without new tools', () => {
  const tool = COMMANDS.find(tool => tool.name === 'preview_resource_change');
  assert.match(tool.description, /certificate, host or loadBalancerService change/);
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('loadBalancerService'));
  assert.match(tool.description, /Certificate and Host support update_metadata with name\/description only/);
  assert.match(tool.description, /material\/private keys.*infrastructure\/credentials.*human console/);
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('certificate'));
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('host'));
  assert.equal(COMMANDS.filter(tool => tool.name === 'preview_resource_change').length, 1);
});
