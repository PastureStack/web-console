import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, PUBLIC_ERROR_CODES, CommandError, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';
const reason = 'BRIDGE_PROJECT_BINDING_REQUIRED';
const planId = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture({transportKind = 'stdio', ready, reasonDetails} = {}) {
  let sequence = 0;
  const snapshot = {generation: 'generation-1', accountId: 'principal-42', projectId: 'p1', projectName: 'Original',
    schemaProjectId: 'p1', schemaGeneration: 1, route: 'stdio'};
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], audit = [], acks = [];
  const options = {context, transportKind, ensureSession: async () => {}, audit: async event => {
    audit.push({...event});
    const ack = {accepted: true, requestId: 'aitool-11111111-1111-1111-1111-' + String(++sequence).padStart(12, '0')};
    const details = typeof reasonDetails === 'function' ? reasonDetails(event) : event.phase === 'start' ? reasonDetails : undefined;
    if (details !== undefined) ack.supportedReasonDetails = details;
    acks.push(ack); return ack;
  }, request: async request => {
    requests.push(request);
    assert.equal(request.url, 'projects/p1/aiResourceChangePlans'); assert.equal(request.method, 'POST');
    const {resourceType, operation, resourceId, parameters} = request.data;
    return {body: {id: planId, resourceType, operation, resourceId, targetPath: 'Original/Target',
      changes: Object.entries(parameters).map(([field, after]) => ({field, before: field === 'name' ? 'Original' : null, after})),
      confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-06T00:00:00Z'}};
  }};
  if (ready !== undefined) options.canRenameSelectedProject = ready;
  const engine = new CommandEngine(options);
  const reference = (resourceType = 'project', id = 'p1') => context.reference('resource',
    {id, family: resourceType === 'project' ? 'environment' : 'host', resourceType, scope: resourceType === 'project' ? 'global' : 'project'}, context.capture());
  const input = (parameters = {name: 'Renamed'}, resourceType = 'project', id = 'p1') => ({resourceType,
    operation: 'update_metadata', targetRef: reference(resourceType, id), parameters});
  return {engine, context, snapshot, requests, audit, acks, input};
}
function audited(f, expectedCode) {
  assert.equal(f.audit.length, 2);
  assert.deepEqual(f.audit.map(row => row.phase), ['start', 'result']);
  assert.equal(f.audit[0].status, 'pending'); assert.equal(f.audit[0].reason, 'NONE');
  assert.equal(f.audit[1].reason, expectedCode);
  assert.ok(f.audit[1].correlationId.startsWith('aitool-'));
  assert.ok(f.audit.every(row => Object.keys(row).every(key => ['command', 'phase', 'status', 'reason', 'correlationId'].includes(key))));
}

test('project profile: unbound stdio rename needs human setup with canonical audit and zero plan dispatch', async () => {
  const f = fixture();
  const result = await f.engine.execute('preview_resource_change', f.input({name: 'PRIVATE-NAME-DO-NOT-ECHO'}));
  assert.equal(result.status, 'needs_user'); assert.equal(result.code, 'NEEDS_USER'); assert.equal(result.reason, reason);
  assert.equal(result.field, 'parameters.name'); assert.equal(f.requests.length, 0); audited(f, 'NEEDS_USER');
  assert.equal(f.audit[1].status, 'needs_user');
  assert.match(result.nextStep, /Ask the user to create a new bound local bridge profile/);
  assert.match(result.nextStep, /Keep the existing profile unchanged/); assert.match(result.nextStep, /Description-only edits remain available/);
  assert.doesNotMatch(JSON.stringify([result, f.audit]), /PRIVATE-NAME|accessKey|secretKey|environmentBinding|projectId|uuid/);
  assert.equal(PUBLIC_ERROR_CODES.includes(reason), false, 'local setup subreason does not expand the native audit reason enum');
  assert.equal(COMMANDS.length, 12);
});

test('project profile: only strict true from the private async owner permits name preview and never approves or applies', async () => {
  const abort = new AbortController(), calls = [];
  const f = fixture({ready: async value => {calls.push(value); return true;}});
  const result = await f.engine.execute('preview_resource_change', f.input(), {signal: abort.signal});
  assert.equal(result.status, 'needs_user'); assert.equal(result.reason, undefined); assert.ok(result.planRef);
  assert.equal(f.requests.length, 1); assert.deepEqual(f.requests[0].data.parameters, {name: 'Renamed'});
  assert.deepEqual(Object.keys(calls[0]), ['name', 'signal']); assert.equal(calls[0].name, 'Renamed'); assert.equal(calls[0].signal, abort.signal);
  assert.equal(f.requests.some(row => /confirm|apply/.test(row.url)), false); audited(f, 'NONE');
  for (const notTrue of [false, null, 'true', {}, 1]) {
    const denied = fixture({ready: async () => notTrue});
    assert.equal((await denied.engine.execute('preview_resource_change', denied.input())).reason, reason);
    assert.equal(denied.requests.length, 0);
  }
});

test('project profile: Browser description-only and existing Host metadata keep their pipeline without calling the rename setup hook', async () => {
  for (const [transportKind, parameters, resourceType] of [['browser', {name: 'Renamed'}, 'project'],
    ['stdio', {description: ''}, 'project'], ['stdio', {name: 'Host custom name'}, 'host']]) {
    let called = 0;
    const f = fixture({transportKind, ready: async () => {called++; return false;}});
    const result = await f.engine.execute('preview_resource_change', f.input(parameters, resourceType));
    assert.equal(result.status, 'needs_user'); assert.ok(result.planRef); assert.equal(result.reason, undefined);
    assert.equal(called, 0); assert.equal(f.requests.length, 1); audited(f, 'NONE');
  }
});

test('project profile: tool payload flags cannot provide the private closure or expand the closed metadata body', async () => {
  for (const patch of [{canRenameSelectedProject: true}, {environmentBinding: {endpoint: 'https://example.test', id: 'p1', uuid: 'adminProject'}},
    {profileBound: true}, {parameters: {name: 'Renamed', canRenameSelectedProject: true}}]) {
    let called = 0;
    const f = fixture({ready: async () => {called++; return true;}});
    const result = await f.engine.execute('preview_resource_change', {...f.input(), ...patch});
    assert.equal(result.code, 'INVALID_INPUT'); assert.equal(f.requests.length, 0); assert.equal(called, 0); audited(f, 'INVALID_INPUT');
  }
});

test('project profile: fresh owner denial and wrong targets cannot turn the local setup hook into native authority', async () => {
  let called = 0;
  const other = fixture({ready: async () => {called++; return true;}});
  assert.equal((await other.engine.execute('preview_resource_change', other.input({name: 'Renamed'}, 'project', 'p2'))).code, 'INVALID_INPUT');
  assert.equal(called, 0); assert.equal(other.requests.length, 0);
  const denied = fixture({ready: async () => {throw {status: 403, body: {code: 'PermissionDenied', message: 'PRIVATE-PROFILE-SECRET'}};}});
  const result = await denied.engine.execute('preview_resource_change', denied.input());
  assert.equal(result.code, 'FORBIDDEN'); assert.equal(result.reason, undefined); assert.equal(denied.requests.length, 0); audited(denied, 'FORBIDDEN');
  assert.doesNotMatch(JSON.stringify([result, denied.audit]), /PRIVATE-PROFILE-SECRET/);
});

test('project profile: pending private hook rechecks generation and safely refuses result audit under replacement session', async () => {
  let release, entered;
  const waiting = new Promise(resolve => {entered = resolve;});
  const raced = fixture({ready: async () => {entered(); return new Promise(resolve => {release = resolve;});}});
  const pending = raced.engine.execute('preview_resource_change', raced.input()); await waiting;
  assert.equal(raced.audit.length, 1); assert.equal(raced.audit[0].phase, 'start');
  assert.equal(raced.acks.length, 1); assert.equal(raced.acks[0].accepted, true);
  assert.match(raced.acks[0].requestId, /^aitool-/);
  raced.snapshot.generation = 'replacement-generation'; release(true);
  const rejected = await pending;
  assert.equal(rejected.code, 'CONTEXT_CHANGED'); assert.equal(rejected.status, 'rejected'); assert.equal(raced.requests.length, 0);
  assert.equal(raced.audit.length, 1, 'the old start audit remains; no result is posted under a replacement session');
  assert.equal(raced.acks.length, 1, 'a second durable ACK must not be fabricated after the context changed');
});



function completionFixture({notify = () => {}, rejectResultAck = false, transportKind = 'stdio'} = {}) {
  let sequence = 0;
  const snapshot = {generation: 'completion-generation', accountId: 'principal-42', projectId: 'p1', projectName: 'Original',
    schemaProjectId: 'p1', schemaGeneration: 1, route: 'stdio'};
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const events = [], requests = [], audit = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, onOperation: notify,
    audit: async event => {
      audit.push({...event}); events.push(event.phase + '-audit');
      return {accepted: !(rejectResultAck && event.phase === 'result'), requestId: 'aitool-22222222-2222-2222-2222-' + String(++sequence).padStart(12, '0')};
    }, request: async request => {
      requests.push(request); events.push('operation-read');
      assert.equal(request.method, 'GET'); assert.equal(request.url, 'projects/p1/aiResourceChangePlans/' + planId);
      return {body: {id: planId, resourceType: 'project', operation: 'update_metadata', resourceId: 'p1', targetPath: 'Renamed',
        changes: [{field: 'name', before: 'Original', after: 'Renamed'}], confirmationState: 'approved', status: 'succeeded', verifiedResult: true}};
    }});
  const operationRef = context.reference('operation', {id: planId, planKind: 'resource-change', resourceType: 'project',
    operation: 'update_metadata', resourceId: 'p1', lastStatus: 'accepted'}, context.capture());
  return {engine, context, snapshot, events, requests, audit, operationRef};
}

test('project profile: completion awaits the private observer after result ACK and isolates label-only errors', async () => {
  let releaseNotice, enteredNotice;
  const entered = new Promise(resolve => {enteredNotice = resolve;});
  const calls = [], signal = new AbortController().signal, begin = Date.now();
  const f = completionFixture({notify: async (notice, options) => {
    calls.push({notice, options}); f.events.push('notice'); enteredNotice();
    await new Promise(resolve => {releaseNotice = resolve;});
  }});
  let settled = false;
  const pending = f.engine.execute('get_operation', {operationRef: f.operationRef}, {signal}).then(result => {settled = true; return result;});
  await entered;
  assert.deepEqual(f.events, ['start-audit', 'operation-read', 'result-audit', 'notice']);
  assert.equal(settled, false, 'the private asynchronous observer must be adopted rather than fire-and-forget');
  assert.equal(calls.length, 1); assert.equal(calls[0].notice.planId, planId);
  assert.deepEqual(Object.keys(calls[0].notice).sort(), ['operation','planId','resourceId','resourceType','status','verifiedResult'].sort());
  assert.equal(calls[0].notice.verifiedResult, true); assert.equal(calls[0].options.signal, signal);
  assert.ok(calls[0].options.startedAt >= begin && calls[0].options.startedAt <= Date.now());
  releaseNotice(); const result = await pending;
  assert.equal(result.status, 'succeeded'); assert.equal(result.verifiedResult, true);
  assert.equal(Object.getOwnPropertySymbols(result).length, 0); assert.equal(f.requests.length, 1);
  assert.ok(f.requests.every(row => row.method === 'GET'), 'completion never submits another apply');
  let rejectedCalls = 0;
  const rejected = completionFixture({notify: async () => {rejectedCalls++; throw Error('PRIVATE-LABEL-OBSERVER');}});
  const preserved = await rejected.engine.execute('get_operation', {operationRef: rejected.operationRef});
  assert.equal(preserved.status, 'succeeded'); assert.equal(preserved.verifiedResult, true); assert.equal(rejectedCalls, 1);
  assert.doesNotMatch(JSON.stringify(preserved), /PRIVATE-LABEL-OBSERVER/);
  assert.equal(preserved.warnings[0].reason, 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING');
  assert.equal(preserved.warnings[0].retryable, true); assert.equal(preserved.warnings[0].retryAfterMs, 1000);
  assert.match(preserved.warnings[0].nextStep, /do not reapply.*rebind.*change targets/);
  for (const [token, retryable] of [['BRIDGE_PROJECT_LABEL_REFRESH_PENDING', true], ['BRIDGE_PROJECT_LABEL_REFRESH_BLOCKED', false]]) {
    const warned = completionFixture({notify: async () => token});
    const done = await warned.engine.execute('get_operation', {operationRef: warned.operationRef});
    assert.equal(done.status, 'succeeded'); assert.equal(done.verifiedResult, true);
    assert.equal(done.warnings[0].reason, token); assert.equal(done.warnings[0].retryable, retryable);
    assert.equal(warned.audit.length, 2); assert.equal(warned.requests.length, 1);
    assert.match(done.warnings[0].nextStep, /[Dd]o not reapply.*rebind.*change targets/);
  }
  let premature = 0;
  const noAck = completionFixture({rejectResultAck: true, notify: () => {premature++;}});
  assert.equal((await noAck.engine.execute('get_operation', {operationRef: noAck.operationRef})).status, 'unknown');
  assert.equal(premature, 0, 'no private completion runs without the normal durable result ACK');
});

test('project profile: pending label recovery is private retryable metadata and fresh capture preserves identity and epoch', async () => {
  for (const forged of [false, true]) {
    const f = fixture();
    f.engine.ensureSession = async () => {
      if (!forged) throw new CommandError('UNKNOWN_RESULT', 'bridge.projectLabelRefresh');
      throw {status: 504, body: {code: 'UNKNOWN_RESULT', field: 'bridge.projectLabelRefresh', reason: 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING', retryable: true}};
    };
    const result = await f.engine.execute('preview_resource_change', f.input({description: ''}));
    assert.equal(result.code, 'UNKNOWN_RESULT'); assert.equal(f.requests.length, 0); audited(f, 'UNKNOWN_RESULT');
    if (forged) { assert.equal(result.reason, undefined); assert.equal(result.retryable, undefined); }
    else {
      assert.equal(result.reason, 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING'); assert.equal(result.retryable, true); assert.equal(result.retryAfterMs, 1000);
      assert.equal(result.field, undefined); assert.match(result.nextStep, /Retry a read in this same environment later/);
      assert.match(result.nextStep, /Do not reapply.*rebind.*change the target/);
    }
  }
  let sequence = 0;
  const snapshot = {generation: 'fresh-label-generation', accountId: 'principal-42', projectId: 'p1', projectName: 'Original',
    schemaProjectId: 'p1', schemaGeneration: 1, route: 'stdio'};
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const before = context.capture();
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {snapshot.projectName = 'Fresh native name';},
    audit: async () => ({accepted: true, requestId: 'aitool-33333333-3333-3333-3333-333333333333'}),
    request: async request => {
      assert.equal(request.method, 'GET'); assert.ok(request.url.startsWith('projects/p1/stacks?'));
      return {body: {data: [{id: 'st1', accountId: 'p1', name: 'Stack'}]}};
    }});
  const found = await engine.execute('find_stacks', {query: 'Stack'});
  assert.equal(found.status, 'succeeded'); assert.equal(found.items[0].displayPath, 'Fresh native name/Stack');
  const after = context.capture(); assert.equal(after.epoch, before.epoch); assert.equal(after.signature, before.signature);
  assert.equal(after.projectId, before.projectId); assert.equal(after.accountId, before.accountId);
});


test('project profile: reason detail is scoped to the fixed tuple and this original start ACK only', async () => {
  const detail = 'BRIDGE_PROJECT_BINDING_REQUIRED';
  const oldKeys = ['command','phase','status','reason','correlationId'].sort();
  for (const capability of [undefined, null, false, detail, {supported: detail}, [], ['UNKNOWN_FUTURE_DETAIL']]) {
    const f = fixture({reasonDetails: capability});
    const result = await f.engine.execute('preview_resource_change', f.input());
    assert.equal(result.code, 'NEEDS_USER'); assert.equal(result.reason, detail); assert.equal(f.requests.length, 0);
    assert.equal(f.audit.length, 2); assert.deepEqual(Object.keys(f.audit[1]).sort(), oldKeys);
    assert.equal(f.audit[1].reason, 'NEEDS_USER');
  }
  let enabled = true;
  const f = fixture({reasonDetails: event => event.phase === 'start' && enabled ? [detail] : event.phase === 'result' ? [detail] : undefined});
  await f.engine.execute('preview_resource_change', f.input());
  assert.equal(f.audit[1].reason, 'NEEDS_USER'); assert.equal(f.audit[1].reasonDetail, detail); assert.equal(f.requests.length, 0);
  assert.deepEqual(Object.keys(f.audit[1]).sort(), [...oldKeys, 'reasonDetail'].sort());
  enabled = false;
  await f.engine.execute('preview_resource_change', f.input());
  assert.deepEqual(Object.keys(f.audit[3]).sort(), oldKeys, 'a later result ACK cannot advertise for its earlier start or reuse a prior invocation capability');
  for (const [kind, parameters, type] of [['browser', {name: 'Renamed'}, 'project'], ['stdio', {description: ''}, 'project'], ['stdio', {name: 'Host custom'}, 'host']]) {
    const other = fixture({transportKind: kind, reasonDetails: [detail]});
    await other.engine.execute('preview_resource_change', other.input(parameters, type));
    assert.equal(other.audit.length, 2); assert.equal(other.audit[1].reasonDetail, undefined);
  }
  for (const patch of [{supportedReasonDetails: [detail]}, {reasonDetail: detail}]) {
    const forged = fixture();
    assert.equal((await forged.engine.execute('preview_resource_change', {...forged.input(), ...patch})).code, 'INVALID_INPUT');
    assert.deepEqual(Object.keys(forged.audit[1]).sort(), oldKeys); assert.equal(forged.requests.length, 0);
  }
  let release, entered;
  const gate = new Promise(resolve => {entered = resolve;});
  const replaced = fixture({reasonDetails: [detail], ready: async () => {entered(); return new Promise(resolve => {release = resolve;});}});
  const pending = replaced.engine.execute('preview_resource_change', replaced.input()); await gate;
  assert.equal(replaced.acks[0].accepted, true); assert.deepEqual(replaced.acks[0].supportedReasonDetails, [detail]);
  replaced.snapshot.generation = 'replacement-session'; release(true);
  assert.equal((await pending).code, 'CONTEXT_CHANGED'); assert.equal(replaced.requests.length, 0);
  assert.equal(replaced.audit.length, 1); assert.equal(replaced.acks.length, 1, 'capability never permits result audit under the replacement session');
});
