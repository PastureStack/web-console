import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const operations = ['finish_upgrade', 'rollback', 'cancel_upgrade'];
const starts = {finish_upgrade: ['upgraded'], rollback: ['upgrading', 'upgraded', 'canceled-upgrade'], cancel_upgrade: ['upgrading', 'finishing-upgrade']};
const terminal = operation => operation === 'cancel_upgrade' ? 'canceled-upgrade' : 'active';
const id = 'aichange-11111111-1111-1111-1111-111111111111';
const secret = 'B2_PRIVATE_PAYLOAD_MUST_NOT_LEAVE';
function fixture({operation = 'finish_upgrade', before = starts[operation][0], transportKind = 'stdio', rejectPreview, rejectApply, statuses = ['succeeded'], verified = true} = {}) {
  const snapshot = {generation: 'g1', accountId: 'actor', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan, dispatches = 0, current = before;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], audits = [], reviews = [], waits = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async value => { waits.push(value); },
    onPlan: value => reviews.push(value), audit: async event => { audits.push(event); return {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') {
        const rows = [{id: 'first', accountId: 'p1', name: 'same', state: before, stackId: 'alpha', stackName: 'Alpha'},
          {id: 'selected', accountId: 'p1', name: 'same', state: current, stackId: 'beta', stackName: 'Beta'}];
        return {body: {resourceType: 'service', data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows, nextMarker: null}};
      }
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (rejectPreview) throw rejectPreview;
        plan = {id, resourceType: 'service', operation, resourceId: request.data.resourceId, targetPath: 'Environment/Beta/same',
          changes: [{field: 'operation', before: null, after: operation}, {field: 'state', before, after: terminal(operation)}],
          status: 'preview', verifiedResult: false, confirmationState: 'pending'};
        return {body: {...plan}};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${id}?action=apply`) {
        if (rejectApply) throw rejectApply;
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: {...plan}};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${id}`) {
        plan.status = statuses.length > 1 ? statuses.shift() : statuses[0]; plan.verifiedResult = plan.status === 'succeeded' && verified;
        if (plan.verifiedResult) current = terminal(operation);
        return {body: {...plan}};
      }
      throw new Error('Unexpected lifecycle fixture route');
    },
  });
  return {engine, context, snapshot, requests, audits, reviews, waits, plan: () => plan,
    dispatches: () => dispatches, humanApprove: () => { plan.confirmationState = 'approved'; }};
}
async function selected(f) {
  const rows = await f.engine.execute('find_resources', {family: 'service', query: 'same'});
  assert.equal(rows.items.length, 2); assert.notEqual(rows.items[0].resourceRef, rows.items[1].resourceRef);
  return rows.items[1].resourceRef;
}
async function preview(f, operation, targetRef) {
  return f.engine.execute('preview_resource_change', {resourceType: 'service', operation, targetRef, parameters: {}});
}

test('Service upgrade lifecycle: existing twelve tools advertise only three native service actions and closed empty parameters', async () => {
  assert.equal(COMMANDS.length, 12);
  const tool = COMMANDS.find(row => row.name === 'preview_resource_change');
  for (const operation of operations) assert(tool.inputSchema.properties.operation.enum.includes(operation));
  assert.equal(tool.inputSchema.properties.operation.enum.includes('cancel_rollback'), false);
  const condition = tool.inputSchema.allOf.find(row => row.if.properties.operation);
  assert.deepEqual(condition.if.properties.operation.enum, operations);
  assert.equal(condition.then.properties.resourceType.const, 'service');
  assert.deepEqual(condition.then.properties.parameters.properties, {});
  assert.equal(condition.then.properties.parameters.additionalProperties, false);
  assert.match(tool.description, /cancellation checkpoint/); assert.match(tool.description, /cancel_rollback.*unsupported/);
  assert.match(tool.description, /finish_upgrade requires upgraded/); assert.match(tool.description, /cancel_upgrade accepts upgrading or finishing-upgrade/);
  const f = fixture(), ref = await selected(f);
  assert.equal((await preview(f, 'cancel_rollback', ref)).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 1);
});

test('Service upgrade lifecycle: browser and Bridge preserve the selected same-name service through exact typed preview and human review', async () => {
  for (const transportKind of ['browser', 'stdio']) for (const operation of operations) for (const before of starts[operation]) {
    const f = fixture({operation, before, transportKind}), ref = await selected(f), result = await preview(f, operation, ref);
    assert.equal(result.status, 'needs_user'); assert.equal(result.displayPath, 'Environment/Beta/same');
    assert.deepEqual(result.displayDiff, [{field: 'operation', before: null, after: operation}, {field: 'state', before, after: terminal(operation)}]);
    assert.deepEqual(f.requests.at(-1).data, {resourceType: 'service', operation, resourceId: 'selected', parameters: {}});
    assert.equal(f.reviews.length, 1); assert.equal(f.dispatches(), 0);
    assert.equal(JSON.stringify(result).includes('resourceId'), false); assert.equal(JSON.stringify(result).includes(id), false);
    assert.deepEqual(f.audits.slice(-2).map(row => row.phase), ['start', 'result']);
    assert(f.requests.every(row => row.method === 'POST' && !row.url.includes('?action=')));
  }
});

test('Service upgrade lifecycle: image strategy state raw IDs wrong siblings and forged parents reject before plan transport with repair guidance', async () => {
  const f = fixture(), ref = await selected(f);
  for (const operation of operations) for (const parameters of [{image: 'docker:app:2'}, {scale: 3}, {startFirst: true}, {state: 'active'}, {url: '/services/selected?action=rollback'}, {launchConfig: {secret}}]) {
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation, targetRef: ref, parameters});
    assert.equal(result.code, 'INVALID_INPUT'); assert.equal(JSON.stringify(result).includes(secret), false);
    if (Object.hasOwn(parameters, 'image')) assert.match(result.nextStep, /empty parameters/);
  }
  for (const resourceType of ['stack', 'loadBalancerService', 'dnsService', 'externalService', 'container']) {
    const result = await f.engine.execute('preview_resource_change', {resourceType, operation: 'rollback', targetRef: ref, parameters: {}});
    assert.equal(result.code, 'INVALID_INPUT');
  }
  for (const input of [{targetRef: 'selected'}, {resourceId: 'selected'}, {parentRef: ref}]) {
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'rollback', targetRef: ref, parameters: {}, ...input});
    assert(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code));
  }
  assert.equal(f.requests.length, 1); assert.equal(f.reviews.length, 0); assert.equal(f.dispatches(), 0);
});

test('Service upgrade lifecycle: review rejects unknown or contradictory phases duplicate fields and private payloads without changing ordinary service plans', () => {
  const f = fixture();
  for (const operation of operations) for (const before of starts[operation]) {
    const plan = {id, resourceType: 'service', operation, targetPath: 'Environment/Beta/same', confirmationState: 'pending',
      changes: [{field: 'operation', before: null, after: operation}, {field: 'state', before, after: terminal(operation)}]};
    assert.equal(f.engine.resourcePlanSummary(plan, 'ref').operation, operation);
    for (const changes of [[], plan.changes.slice(0, 1), [...plan.changes, {field: 'image', before: 'old', after: 'new'}],
      [plan.changes[0], plan.changes[0]], [{...plan.changes[0], after: 'cancel_rollback'}, plan.changes[1]],
      [plan.changes[0], {...plan.changes[1], before: secret}], [plan.changes[0], {...plan.changes[1], after: 'upgraded'}],
      [...plan.changes, {field: 'generation', before: null, after: secret}]]) {
      assert.throws(() => f.engine.resourcePlanSummary({...plan, changes}), {code: 'INVALID_RESPONSE'});
    }
  }
  assert.equal(f.engine.resourcePlanSummary({id, resourceType: 'service', operation: 'start', targetPath: 'normal', confirmationState: 'pending',
    changes: [{field: 'state', before: 'inactive', after: 'active'}]}).operation, 'start');
});

test('Service upgrade lifecycle: human approval and verified operation receipt are required and cancellation reports only its checkpoint', async () => {
  for (const operation of operations) {
    const f = fixture({operation, statuses: ['running', 'succeeded']}), ref = await selected(f), prepared = await preview(f, operation, ref);
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: prepared.planRef})).code, 'NEEDS_USER');
    assert.equal(f.dispatches(), 0); f.humanApprove(); // Independent normal human approval is server-owned, never a model tool.
    const submitted = await f.engine.execute('apply_resource_change', {planRef: prepared.planRef});
    assert.equal(submitted.status, 'accepted'); assert.equal(submitted.verifiedResult, false);
    const completed = await f.engine.execute('get_operation', {operationRef: submitted.operationRef});
    assert.equal(completed.status, 'succeeded'); assert.equal(completed.verifiedResult, true); assert.equal(f.dispatches(), 1);
    assert.equal(f.waits.length, 1); assert.equal((await f.engine.execute('get_resource', {resourceRef: ref})).fields.state, terminal(operation));
    if (operation === 'cancel_upgrade') {
      assert.equal(completed.completionScope, 'cancellation-checkpoint'); assert.match(completed.nextStep, /has not been completed/);
    } else assert.equal(Object.hasOwn(completed, 'completionScope'), false);
    assert.equal(f.requests.some(row => row.url.includes('confirm') || /[?&]action=(finishupgrade|rollback|cancelupgrade)/.test(row.url)), false);
  }
  const f = fixture({verified: false}), prepared = await preview(f, 'finish_upgrade', await selected(f)); f.humanApprove();
  const submitted = await f.engine.execute('apply_resource_change', {planRef: prepared.planRef});
  assert.equal((await f.engine.execute('get_operation', {operationRef: submitted.operationRef})).status, 'unknown');
});

test('Service upgrade lifecycle: native owner Key and phase denials remain authoritative redacted and never retry through a native action', async () => {
  for (const [status, code, expected] of [[403, 'PermissionDenied', 'FORBIDDEN'], [403, 'KeyScopeDenied', 'FORBIDDEN'],
    [403, 'ApiKeyPolicyChanged', 'FORBIDDEN'], [409, 'ResourceChangePlanStale', 'CONFLICT']]) {
    for (const stage of ['preview', 'apply']) {
      const f = fixture({[stage === 'preview' ? 'rejectPreview' : 'rejectApply']: {status, body: {code, message: secret}}});
      const ref = await selected(f), prepared = await preview(f, 'finish_upgrade', ref);
      let result = prepared;
      if (stage === 'apply') { f.humanApprove(); result = await f.engine.execute('apply_resource_change', {planRef: prepared.planRef}); }
      assert.equal(result.code, expected); assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(f.dispatches(), 0);
      assert.equal(f.requests.filter(row => row.url.includes('?action=apply')).length, stage === 'apply' ? 1 : 0);
      assert.equal(f.requests.some(row => row.url.includes('finishupgrade') || row.url.includes('cancelupgrade')), false);
    }
  }
});

test('Service upgrade lifecycle: stale session and unknown accepted response never become completion or trigger an extra business write', async () => {
  const f = fixture(), ref = await selected(f), prepared = await preview(f, 'finish_upgrade', ref);
  f.snapshot.generation = 'g2';
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: prepared.planRef})).code, 'STALE_REFERENCE');
  assert.equal(f.dispatches(), 0);
  const lost = fixture({rejectApply: {status: 503, body: {code: 'Unavailable', message: secret}}}), preparedLost = await preview(lost, 'finish_upgrade', await selected(lost));
  lost.humanApprove(); const result = await lost.engine.execute('apply_resource_change', {planRef: preparedLost.planRef});
  assert.equal(result.status, 'unknown'); assert.notEqual(result.verifiedResult, true); assert(result.operationRef);
  assert.equal(lost.requests.filter(row => row.url.includes('?action=apply')).length, 1); assert.equal(JSON.stringify(result).includes(secret), false);
});
