import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';
import {readFileSync} from 'node:fs';
const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));

const id = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture() {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/certificates'};
  let sequence = 0, plan, dispatches = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], rows = ['first', 'selected'].map(suffix => ({id: `cert-${suffix}`, accountId: 'p1', name: 'same-name', description: suffix,
    state: 'active', CN: `${suffix}.example.test`, cert: 'PRIVATE-CERT-CANARY', key: 'PRIVATE-KEY-CANARY', data: {key: 'PRIVATE-DATA-CANARY'}}));
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {}, wait: async () => {},
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'certificate',
        data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id, resourceType, operation, resourceId, targetPath: 'Environment / same-name',
          changes: Object.entries(parameters).map(([field, after]) => ({field, before: field === 'name' ? 'same-name' : 'selected', after})),
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-01T00:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: {...plan}};
      }
      if (request.url.endsWith(id)) return {body: {...plan}};
      throw Error('Unexpected fixed route');
    }});
  return {engine, context, snapshot, requests, rows, plan: () => plan, dispatches: () => dispatches};
}

test('certificate: selected same-name opaque reference -> safe metadata -> human approved plan -> verified receipt', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'certificates', query: 'same-name'});
  assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
  const targetRef = found.items[1].resourceRef;
  const detail = await f.engine.execute('get_resource', {resourceRef: targetRef});
  assert.equal(detail.fields.CN, 'selected.example.test'); assert.equal(JSON.stringify([found, detail]).includes('PRIVATE-'), false);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'certificate', operation: 'update_metadata', targetRef,
    parameters: {name: 'renamed', description: ''}});
  assert.equal(preview.status, 'needs_user'); assert.equal(f.requests.at(-1).data.resourceId, 'cert-selected');
  assert.equal(JSON.stringify(preview).includes('cert-selected'), false);
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.dispatches(), 0); await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(accepted.status, 'accepted'); assert.equal(f.dispatches(), 1);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const observed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(observed.status, 'succeeded'); assert.equal(observed.verifiedResult, true);
  assert.ok(f.requests.every(request => request.method !== 'PUT' && !request.url.includes('/certificates')));
});

test('certificate: material, raw IDs and unsupported intents never reach transport', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'certificates'});
  const input = {resourceType: 'certificate', operation: 'update_metadata', targetRef: found.items[0].resourceRef};
  const before = f.requests.length;
  for (const field of ['cert', 'key', 'certChain', 'data', 'accountId', 'uuid', 'state']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {[field]: 'PRIVATE-CANARY'}})).code, 'INVALID_INPUT');
  }
  for (const operation of ['create', 'remove', 'start', 'stop', 'update_targets']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, operation, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  }
  assert.equal((await f.engine.execute('preview_resource_change', {...input, targetRef: 'cert-first', parameters: {name: 'x'}})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, before);
});

test('certificate: project changes invalidate issued references before preview', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'certificates'});
  const before = f.requests.length; f.snapshot.projectId = 'foreign'; f.snapshot.schemaProjectId = 'foreign';
  const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'certificate', operation: 'update_metadata',
    targetRef: found.items[0].resourceRef, parameters: {name: 'new'}});
  assert.ok(['CONTEXT_CHANGED', 'STALE_REFERENCE'].includes(rejected.code)); assert.equal(f.requests.length, before);
});

test('certificate: capabilities, closed input enum and human review expose only metadata changes', async () => {
  const f = fixture(), capability = (await f.engine.execute('list_capabilities', {})).families.find(family => family.family === 'certificates').resources[0];
  assert.deepEqual(capability.operations, ['update_metadata']);
  const tool = COMMANDS.find(tool => tool.name === 'preview_resource_change');
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('certificate'));
  const labels = resourceReviewLabels({resourceType: 'certificate', operation: 'update_metadata', displayDiff: [{field: 'description', before: null, after: ''}]}, key => key);
  assert.equal(labels.resourceTypeLabel, 'certificatesPage.index.header'); assert.equal(labels.operationLabel, 'generic.edit');
});
