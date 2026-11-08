import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine, RESOURCE_CHANGES} from '../bridge/shared-modules.mjs';
import {readFileSync} from 'node:fs';
const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));

const id = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture(transportKind = 'stdio') {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'same-name', schemaProjectId: 'p1', schemaGeneration: 1, route: '/projects'};
  let sequence = 0, plan, dispatches = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const faults = {}, requests = [], rows = ['p2', 'p1'].map(id => ({id, name: 'same-name', description: id === 'p1' ? null : '', state: 'active',
    orchestration: 'cattle', members: ['PRIVATE-MEMBERS'], data: {network: 'PRIVATE-NETWORK'}, auth: 'PRIVATE-AUTH'}));
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async () => {},
    canRenameSelectedProject: async () => true, // This existing positive fixture represents an explicitly bound adapter.
    audit: async () => ({accepted: true, requestId: `audit${++sequence}`}), request: async request => {
      requests.push(request);
      if (request.url === `projects/${snapshot.projectId}/aiResourceViews`) return {body: {resourceType: 'project',
        data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows}};
      if (request.url === 'projects?limit=50') return {body: {data: rows}};
      if (/^projects\/p[12]$/.test(request.url)) return {body: rows.find(row => request.url.endsWith(row.id))};
      if (request.url === `projects/${snapshot.projectId}/aiResourceChangePlans`) {
        if (faults.preview) throw faults.preview;
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id, resourceType, operation, resourceId, targetPath: 'same-name',
          changes: Object.entries(parameters).map(([field, after]) => ({field, before: field === 'name' ? 'same-name' : null, after})),
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-06T00:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted';
        if (faults.apply) throw faults.apply;
        return {body: {...plan}};
      }
      if (request.url.endsWith(id)) return {body: {...plan}};
      throw Error('Unexpected closed project route: ' + request.url);
    }});
  return {engine, context, snapshot, requests, rows, faults, plan: () => plan, dispatches: () => dispatches};
}
async function projects(f) { return f.engine.execute('find_resources', {family: 'environment', resourceType: 'project', query: 'same-name'}); }

test('project: exact selected global opaque ref uses shared browser/stdio preview, normal human approval and verified operation', async () => {
  for (const kind of ['browser', 'stdio']) {
    const f = fixture(kind), found = await projects(f);
    assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
    assert.equal(found.items[0].scope, 'global');
    const targetRef = found.items[1].resourceRef;
    assert.equal((await f.engine.execute('get_resource', {resourceRef: targetRef})).fields.description, null);
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef,
      parameters: {name: 'literal <script> RTL فارسی', description: ''}});
    assert.equal(preview.status, 'needs_user'); assert.equal(f.requests.at(-1).data.resourceId, 'p1');
    assert.equal(f.snapshot.projectId, 'p1'); assert.equal(JSON.stringify([found, preview]).includes('PRIVATE-'), false);
    assert.equal(JSON.stringify(preview).includes('"p1"'), false);
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
    assert.equal(f.dispatches(), 0); await f.engine.confirmPlan(preview.planRef);
    const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    assert.equal(accepted.status, 'accepted'); assert.equal(f.dispatches(), 1);
    f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
    const observed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
    assert.equal(observed.status, 'succeeded'); assert.equal(observed.verifiedResult, true);
    assert.ok(f.requests.every(r => r.method !== 'PUT' && !/setmembers|networks|activate|deactivate/.test(r.url)));
  }
});

test('project: a visible same-name other environment is queryable but cannot be edited until normal switch and fresh ref', async () => {
  const f = fixture(), found = await projects(f), before = f.requests.length;
  assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[0].resourceRef, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, before); assert.equal(f.snapshot.projectId, 'p1');
  f.snapshot.projectId = 'p2'; f.snapshot.schemaProjectId = 'p2';
  const stale = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[0].resourceRef, parameters: {name: 'x'}});
  assert.ok(['CONTEXT_CHANGED', 'STALE_REFERENCE'].includes(stale.code));
  const fresh = await projects(f);
  const next = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: fresh.items[0].resourceRef, parameters: {description: null}});
  assert.equal(next.status, 'needs_user'); assert.equal(f.requests.at(-1).url, 'projects/p2/aiResourceChangePlans');
  assert.equal(f.requests.at(-1).data.resourceId, 'p2'); assert.equal(f.requests.at(-1).data.parameters.description, null);
});

test('project: closed metadata body, bounds, raw IDs, parent refs and unsupported intents reject before plan transport', async () => {
  const f = fixture(), found = await projects(f), base = {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[1].resourceRef};
  const before = f.requests.length;
  for (const parameters of [{}, {name: ''}, {name: 'x'.repeat(256)}, {description: 'x'.repeat(1025)}, {description: 3},
    ...['members','projectLinks','network','orchestration','virtualMachine','labels','accountId','uuid','state','default','auth','credentials','data','url','method','launchConfig'].map(field => ({[field]: 'PRIVATE-CANARY'}))]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters})).code, 'INVALID_INPUT');
  }
  for (const operation of ['create','remove','start','stop','archive','restore','update_targets'])
    assert.equal((await f.engine.execute('preview_resource_change', {...base, operation, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  assert.equal((await f.engine.execute('preview_resource_change', {...base, targetRef: 'p1', parameters: {name: 'x'}})).code, 'STALE_REFERENCE');
  assert.equal((await f.engine.execute('preview_resource_change', {...base, parentRef: found.items[0].resourceRef, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, before);
});

test('project: global-reference exception cannot admit projectTemplate/account or a project pretending to have project scope', async () => {
  const f = fixture(), captured = f.context.capture(), before = f.requests.length;
  for (const [resourceType, scope] of [['projectTemplate','global'],['account','global'],['certificate','global'],['project','project']]) {
    const targetRef = f.context.reference('resource', {id: 'p1', family: 'environment', resourceType, scope}, captured);
    assert.equal((await f.engine.execute('preview_resource_change', {resourceType, operation: 'update_metadata', targetRef, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  }
  assert.equal(f.requests.length, before);
});

test('project: current generation or principal changes invalidate refs and prior approval before dispatch', async () => {
  for (const field of ['generation','accountId','schemaGeneration']) {
    const f = fixture(), found = await projects(f);
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[1].resourceRef, parameters: {description: ''}});
    await f.engine.confirmPlan(preview.planRef); const before = f.requests.length;
    f.snapshot[field] = field === 'schemaGeneration' ? 2 : 'changed';
    const denied = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    assert.ok(['CONTEXT_CHANGED','STALE_REFERENCE'].includes(denied.code)); assert.equal(f.requests.length, before); assert.equal(f.dispatches(), 0);
  }
});

test('project: native live denials and lost accepted response stay closed without retries or raw details', async () => {
  for (const [status, code, expected] of [[403,'PermissionDenied','FORBIDDEN'],[409,'ResourceChangePlanStale','CONFLICT']]) {
    const f = fixture(), found = await projects(f); f.faults.preview = {status, body: {code, message: 'PRIVATE-CANARY'}};
    const denied = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[1].resourceRef, parameters: {description: null}});
    assert.equal(denied.code, expected); assert.equal(JSON.stringify(denied).includes('PRIVATE-'), false); assert.equal(f.dispatches(), 0);
  }
  const f = fixture(), found = await projects(f);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[1].resourceRef, parameters: {description: ''}});
  await f.engine.confirmPlan(preview.planRef); f.faults.apply = Error('PRIVATE-TRANSPORT-CANARY');
  const uncertain = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(uncertain.status, 'unknown'); assert.ok(uncertain.operationRef); assert.equal(f.dispatches(), 1);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  assert.equal((await f.engine.execute('get_operation', {operationRef: uncertain.operationRef})).verifiedResult, true);
  assert.equal(f.dispatches(), 1); assert.equal(f.requests.filter(r => r.url.endsWith('?action=apply')).length, 1);
});

test('project: exact tool/parameters and existing locale review labels describe selected metadata without another tool', async () => {
  assert.equal(COMMANDS.length, 12); const f = fixture();
  const capability = (await f.engine.execute('list_capabilities', {})).families.find(x => x.family === 'environment').resources.find(x => x.resourceType === 'project');
  assert.deepEqual(capability.operations, ['update_metadata', 'switch_context', 'set_default']);
  assert.deepEqual(Object.entries(RESOURCE_CHANGES.project).filter(([, descriptor]) => descriptor.execution === 'native-wire').map(([operation]) => operation), ['update_metadata']);
  for (const operation of ['switch_context', 'set_default']) {
    const descriptor = RESOURCE_CHANGES.project[operation];
    assert.equal(descriptor.execution, 'browser-human-confirmation');
    assert.equal(descriptor.wire, null); assert.equal(descriptor.modelApply, 'needs_user');
    assert.deepEqual(descriptor.fields, []);
  }
  const tool = COMMANDS.find(t => t.name === 'preview_resource_change');
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('project')); assert.match(tool.description, /currently selected environment/); assert.match(tool.description, /switch environments normally/);
  const plan = {resourceType: 'project', operation: 'update_metadata', displayDiff: [{field: 'description', before: null, after: ''},{field: 'name', before: 'old', after: '<script>فارسی</script>'}]};
  const labels = resourceReviewLabels(plan, key => key);
  assert.equal(labels.resourceTypeLabel, 'apiKeyAccess.selector.types.project'); assert.equal(labels.operationLabel, 'generic.edit');
  assert.equal(labels.displayChanges[1].after, '<script>فارسی</script>'); assert.notEqual(labels.displayChanges[0].before, labels.displayChanges[0].after);
});

test('project: selected-target guidance repairs the visible-other-project error without looping or suggesting a forbidden switch', async () => {
  const f = fixture(), found = await projects(f), before = f.requests.length;
  const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[0].resourceRef, parameters: {name: 'x'}});
  assert.equal(rejected.code, 'INVALID_INPUT'); assert.equal(rejected.field, 'targetRef');
  assert.match(rejected.nextStep, /Only the currently selected environment/);
  assert.match(rejected.nextStep, /ask the user to switch environments normally/);
  assert.match(rejected.nextStep, /find_resources again for a fresh project resourceRef/);
  assert.match(rejected.nextStep, /Never guess an ID or modify the original reference/);
  assert.equal(f.requests.length, before); assert.equal(f.snapshot.projectId, 'p1'); assert.equal(f.dispatches(), 0);
  f.faults.preview = {status: 403, body: {code: 'PermissionDenied'}};
  const denied = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[1].resourceRef, parameters: {name: 'x'}});
  assert.equal(denied.code, 'FORBIDDEN'); assert.doesNotMatch(denied.nextStep, /switch environments normally/);
  assert.match(denied.nextStep, /Do not try another ID or environment/);
  f.snapshot.projectId = 'p2'; f.snapshot.schemaProjectId = 'p2';
  const stale = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: found.items[0].resourceRef, parameters: {name: 'x'}});
  assert.ok(['STALE_REFERENCE','CONTEXT_CHANGED'].includes(stale.code)); assert.doesNotMatch(stale.nextStep, /Only the currently selected environment/);
});
