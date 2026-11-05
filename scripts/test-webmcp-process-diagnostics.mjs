import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS, resourceDescriptors} from '../bridge/shared-modules.mjs';

const secret = 'PRIVATE_PAYLOAD_SENTINEL';
function fixture(transportKind) {
  const snapshot = {generation: 'g1', accountId: 'admin', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0;
  const context = new CommandContext(() => snapshot, () => `ref${++sequence}`); context.setMode('read-only');
  const rows = ['private-id-a', 'private-id-b'].map(id => ({id, type: 'processInstance', name: 'service.create', processName: 'service.create',
    phase: 'HANDLERS', exitReason: 'TIMEOUT', startTime: '2026-11-06T00:00:00Z', endTime: null, executionCount: 2,
    diagnosticStatus: 'available', diagnosticCompleteness: 'unknown', failedHandler: 'CreateHandler', hasException: true,
    description: secret, message: secret, cause: secret, stackTrace: secret, result: secret, data: {token: secret},
    children: [{name: secret}], resourceId: secret}));
  const requests = [], audits = [];
  const f = {rows, snapshot, requests, audits, deny: false, mutate: null, replacement: null};
  f.engine = new CommandEngine({context, transportKind, ensureSession: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: `audit${++sequence}`}; },
    request: async request => {
      requests.push(request);
      assert.equal(request.url, 'projects/p1/aiResourceViews'); assert.equal(request.method, 'POST');
      if (f.deny) throw {status: 403, body: {code: 'KeyScopeDenied', message: secret}};
      if (f.mutate) f.mutate();
      const detail = request.data.resourceId;
      return {body: {resourceType: 'processInstance', data: detail ? [f.replacement || rows.find(row => row.id === detail)] : rows,
        nextMarker: detail || request.data.marker ? null : rows.at(-1).id}};
    },
  });
  return f;
}

test('process diagnostics: browser and stdio retain opaque same-name refs, cursors and stale/denied boundaries without writes', async () => {
  assert.equal(COMMANDS.length, 12);
  assert.equal(resourceDescriptors().filter(row => row.type === 'processInstance').length, 1);
  assert.equal(resourceDescriptors().find(row => row.type === 'processExecution').scope, 'global');
  for (const transport of ['browser', 'stdio']) {
    const f = fixture(transport), query = {family: 'processes', resourceType: 'processInstance', query: 'service'};
    const found = await f.engine.execute('find_resources', query);
    assert.equal(found.status, 'succeeded'); assert.equal(found.items.length, 2); assert.equal(found.complete, false);
    assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
    assert.equal(JSON.stringify(found).includes('private-id'), false); assert.equal(JSON.stringify(found).includes(secret), false);
    const before = f.requests.length;
    assert.equal((await f.engine.execute('find_resources', {...query, cursor: found.nextCursor, query: 'other'})).code, 'INVALID_INPUT');
    assert.equal(f.requests.length, before);
    const next = await f.engine.execute('find_resources', {...query, cursor: found.nextCursor});
    assert.equal(next.complete, true); assert.equal(f.requests.at(-1).data.marker, 'private-id-b');
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[1].resourceRef});
    assert.equal(detail.fields.failedHandler, 'CreateHandler'); assert.equal(f.requests.at(-1).data.resourceId, 'private-id-b');
    assert.equal(detail.fields.diagnosticCompleteness, 'unknown'); assert.match(detail.nextStep, /not a verified/);
    assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'processInstance', operation: 'replay', targetRef: found.items[0].resourceRef})).code, 'INVALID_INPUT');
    f.replacement = f.rows[0];
    assert.equal((await f.engine.execute('get_resource', {resourceRef: found.items[1].resourceRef})).code, 'INVALID_RESPONSE');
    f.replacement = null; f.deny = true;
    assert.equal((await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef})).code, 'FORBIDDEN');
    f.deny = false; f.mutate = () => { f.snapshot.generation = 'g2'; };
    assert.equal((await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef})).code, 'CONTEXT_CHANGED');
    assert.equal(JSON.stringify([f.audits, detail]).includes(secret), false);
    assert.ok(f.requests.every(row => row.url.endsWith('/aiResourceViews')));
  }
});

test('process diagnostics: closed safe fields reject raw errors and unknown enum/timestamp claims without implying completion', async () => {
  const f = fixture('browser');
  const found = await f.engine.execute('find_resources', {family: 'processes', resourceType: 'processInstance'});
  Object.assign(f.rows[0], {name: secret, processName: 'not a registered process', phase: secret, exitReason: secret,
    runAfter: secret, failedHandler: 'untrusted handler with spaces', diagnosticStatus: 'completed', diagnosticCompleteness: 'complete',
    displayPath: secret, executionCount: -1});
  const list = await f.engine.execute('find_resources', {family: 'processes', resourceType: 'processInstance'});
  const result = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  for (const field of ['name', 'processName', 'phase', 'exitReason', 'runAfter', 'failedHandler', 'executionCount', 'diagnosticStatus', 'diagnosticCompleteness'])
    assert.equal(Object.hasOwn(result.fields, field), false, field);
  assert.equal(JSON.stringify([list, result, f.audits]).includes(secret), false);
  assert.equal(result.payloadPolicy, 'HUMAN_ONLY_NATIVE_PROCESS_ERROR_UI');
  assert.match(result.nextStep, /completeness remains unknown/); assert.match(result.nextStep, /do not guess causes, replay, retry/);
  assert.equal(Object.hasOwn(result, 'verifiedResult'), false);
});


test('process diagnostics: global diagnostic budgets expose only fixed truncation reasons and never retained partial conclusions', async () => {
  const f = fixture('browser');
  const found = await f.engine.execute('find_resources', {family: 'processes', resourceType: 'processInstance'});
  for (const reason of ['source_limit', 'entry_budget', 'utf8_budget']) {
    Object.assign(f.rows[0], {diagnosticStatus: 'available', diagnosticCompleteness: 'complete', diagnosticTruncated: true,
      diagnosticTruncationReason: reason, hasException: false, failedHandler: 'CreateHandler'});
    const result = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
    assert.equal(result.fields.diagnosticStatus, 'unknown'); assert.equal(result.fields.diagnosticCompleteness, 'unknown');
    assert.equal(result.fields.diagnosticTruncated, true); assert.equal(result.fields.diagnosticTruncationReason, reason);
    assert.equal(Object.hasOwn(result.fields, 'failedHandler'), false); assert.equal(Object.hasOwn(result.fields, 'hasException'), false);
    assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(Object.hasOwn(result, 'verifiedResult'), false);
  }
  f.rows[0].diagnosticTruncationReason = secret;
  const invalid = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(Object.hasOwn(invalid.fields, 'diagnosticTruncationReason'), false);
  assert.equal(invalid.fields.diagnosticTruncated, true); assert.equal(invalid.fields.diagnosticStatus, 'unknown');
  assert.equal(invalid.fields.diagnosticCompleteness, 'unknown');
  assert.equal(JSON.stringify(invalid).includes(secret), false);
});
