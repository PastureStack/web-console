import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
import {allowedRequest} from '../bridge/core.mjs';

const range = {from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z'};
const secret = 'PRIVATE_PAYLOAD_MUST_NOT_REACH_MODEL';
const row = (id = 'event1', extra = {}) => ({type: 'auditLog', id, accountId: 'p1', created: '2026-10-01T12:00:00Z',
  eventType: 'api.service.update', decision: 'DENY', outcome: 'FAILED', httpStatus: 403, operation: 'update',
  payloadsIncluded: false, requestPayloadPresence: 'present', responsePayloadPresence: 'not_projected', ...extra});
const reply = (rows = [row()], extra = {}) => ({body: {resourceType: 'auditLog', data: rows, range,
  total: rows.length, nextOffset: null, payloadPolicy: 'HUMAN_ONLY_NATIVE_AUDIT_UI', ...extra}});

function fixture(handle, transportKind = 'browser', audit) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Selected',
    schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('read-only');
  const requests = [], audits = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {},
    audit: async event => { audits.push(event); if (audit) return audit(event); return {accepted: true, requestId: 'safe-request'}; },
    request: async request => { requests.push(request); return handle ? handle(request) : reply(); }});
  return {engine, context, snapshot, requests, audits};
}
const find = (filters = {}, cursor) => ({family: 'audit', resourceType: 'auditLog', auditFilters: filters, ...(cursor ? {cursor} : {})});

test('audit workflow resolves real returned Key/project refs, freezes range and reauthorizes event detail', async () => {
  const f = fixture(({url, method, data}) => {
    if (url === 'projects/p1/aiResourceViews') {
      assert.equal(data.resourceType, 'apiKey');
      return {body: {resourceType: 'apiKey', data: [{id: '1c99', name: 'My Key', secretValue: secret}], nextMarker: null}};
    }
    if (url === 'projects?limit=50') return {body: {data: [{id: 'p2', name: 'Other visible environment'}]}};
    assert.equal(url, 'pasturestack/ai-audit-queries'); assert.equal(method, 'POST');
    assert.equal(data.keyId, '1c99'); assert.equal(data.environmentId, 'p2');
    assert.equal(data.from, range.from); assert.equal(data.to, range.to);
    const index = data.eventId ? data.eventId : data.offset ? 'event2' : 'event1';
    return reply([row(index, {keyId: '1c99', accountId: 'p2'})], {total: data.eventId ? 1 : 2,
      nextOffset: data.eventId || data.offset ? null : 1});
  });
  const keys = await f.engine.execute('find_resources', {family: 'api-keys'});
  const projects = await f.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  const filters = {...range, keyRef: keys.items[0].resourceRef, environmentRef: projects.items[0].resourceRef, decision: 'DENY', limit: 1};
  const first = await f.engine.execute('find_resources', find(filters));
  assert.equal(first.status, 'succeeded'); assert.equal(first.complete, false); assert.equal(first.items.length, 1);
  assert.equal(first.workflowCoverage, 'authorized-metadata-query'); assert.equal(first.items[0].fields.httpStatus, 403);
  const next = await f.engine.execute('find_resources', find(filters, first.nextCursor));
  assert.equal(next.status, 'succeeded'); assert.equal(next.complete, true);
  const detail = await f.engine.execute('get_resource', {resourceRef: first.items[0].resourceRef});
  assert.equal(detail.status, 'succeeded'); assert.equal(detail.fields.payloadsIncluded, false);
  assert.equal(detail.payloadPolicy, 'HUMAN_ONLY_NATIVE_AUDIT_UI');
  assert.equal(JSON.stringify([first, next, detail, f.audits]).includes(secret), false);
  assert.equal(JSON.stringify(first).includes('1c99'), false);
});

test('audit cursor cannot transfer filters or become a generic metadata cursor', async () => {
  const f = fixture(() => reply([row()], {total: 2, nextOffset: 1}));
  const first = await f.engine.execute('find_resources', find(range));
  assert.equal(first.status, 'succeeded');
  let result = await f.engine.execute('find_resources', find({...range, decision: 'ALLOW'}, first.nextCursor));
  assert.equal(result.code, 'INVALID_INPUT');
  result = await f.engine.execute('find_resources', {family: 'audit', cursor: first.nextCursor});
  assert.equal(result.code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 1);
});

test('audit typed schema rejects raw IDs, arbitrary endpoints, wrong families/references and invalid ranges', async () => {
  const f = fixture();
  const captured = f.context.capture();
  const wrong = f.context.reference('resource', {id: 's1', resourceType: 'service', scope: 'project'}, captured);
  for (const input of [
    find({keyId: '1c99'}), find({url: 'https://outside.invalid'}), find({responseObject: true}),
    {...find({}), family: 'service'}, {...find({}), query: 'name'}, find({keyRef: wrong}),
    find({environmentRef: wrong}), find({from: range.from}), find({lastMinutes: 1, ...range}),
    find({limit: 51}), find({decision: 'ALLOW OR DENY'}),
  ]) {
    const result = await f.engine.execute('find_resources', input);
    assert.equal(result.code, 'INVALID_INPUT'); assert.equal(result.status, 'rejected');
  }
  assert.equal(f.requests.length, 0);
});

test('audit stdio uses only the fixed typed owner route while raw audit routes remain excluded', async () => {
  const f = fixture(undefined, 'stdio');
  const caps = await f.engine.execute('list_capabilities', {});
  const audit = caps.families.find(item => item.family === 'audit').resources[0];
  assert.equal(audit.typedAuditQuery.availability, 'implemented');
  assert.equal(audit.typedAuditQuery.transport, 'native-cookie-or-dedicated-api-key');
  const result = await f.engine.execute('find_resources', find({}));
  assert.equal(result.status, 'succeeded');
  assert.match(result.nextStep, /current audit read scope/); assert.equal(f.requests.length, 1);
  assert.equal(allowedRequest('pasturestack/ai-audit-queries', 'POST', 'p1'), true);
  assert.equal(allowedRequest('pasturestack/audit-logs', 'GET', 'p1'), false);
});

test('audit known native denials stay rejected and scan-limit errors preserve actionable filters', async () => {
  for (const [status, code] of [[401, 'SESSION_REQUIRED'], [403, 'FORBIDDEN'], [404, 'FORBIDDEN']]) {
    const f = fixture(() => { throw {status, body: {code: 'audit_upstream_denied', message: secret}}; });
    const result = await f.engine.execute('find_resources', find({}));
    assert.equal(result.code, code); assert.notEqual(result.status, 'succeeded');
    assert.equal(JSON.stringify([result, f.audits]).includes(secret), false);
  }
  const f = fixture(() => { throw {status: 422, body: {code: 'result_set_too_large', message: secret}}; });
  const result = await f.engine.execute('find_resources', find({lastMinutes: 60}));
  assert.equal(result.code, 'INVALID_INPUT'); assert.equal(result.field, 'auditFilters.timeRange');
  assert.match(result.nextStep, /20,000-row/); assert.equal(f.requests.length, 1);
});

test('audit malformed metadata, widened range and broken pagination cannot leak private payload or false-complete', async () => {
  for (const handle of [
    () => reply([row('event1', {responseObject: {secret}})]),
    () => reply([row()], {range: {...range, secret}}),
    () => reply([row()], {range: {...range, to: '2026-10-03T00:00:00Z'}}),
    () => reply([row()], {total: 2, nextOffset: null}),
    () => reply([row('event1', {accountId: 'foreign'})]),
  ]) {
    const f = fixture(handle);
    const result = await f.engine.execute('find_resources', find(range));
    assert.equal(result.code, 'INVALID_RESPONSE'); assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test('audit late actor/session response is discarded and start-audit failure gates the native query', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture(() => pending);
  const running = f.engine.execute('find_resources', find({}));
  while (!f.requests.length) await new Promise(resolve => setImmediate(resolve));
  f.snapshot.generation = 'g2'; f.snapshot.accountId = 'other';
  finish(reply());
  const result = await running;
  assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(result.items, undefined);
  assert.equal(f.audits.length, 1);
  const blocked = fixture(undefined, 'browser', () => { throw Error(secret); });
  assert.equal((await blocked.engine.execute('find_resources', find({}))).code, 'UNAVAILABLE');
  assert.equal(blocked.requests.length, 0);
  assert.equal(COMMANDS.length, 12);
});

test('audit unavailable owner and invalid authority diagnostics remain bounded read failures', async () => {
  for (const [status, nativeCode, expected] of [[502, 'audit_upstream_unavailable', 'UNAVAILABLE'],
    [503, 'key_audit_unavailable', 'UNAVAILABLE'], [502, 'invalid_key_authority', 'INVALID_RESPONSE'],
    [403, 'ai_audit_cookie_required', 'FORBIDDEN']]) {
    const f = fixture(() => { throw {status, body: {code: nativeCode, message: secret}}; });
    const result = await f.engine.execute('find_resources', find({lastMinutes: 30}));
    assert.equal(result.code, expected); assert.notEqual(result.status, 'succeeded');
    assert.equal(f.requests.length, 1); assert.equal(JSON.stringify([result, f.audits]).includes(secret), false);
    if (expected === 'UNAVAILABLE') assert.match(result.nextStep, /temporarily unavailable/);
    if (nativeCode === 'ai_audit_cookie_required') assert.match(result.nextStep, /matching Engine and broker audit-query components/);
  }
});
