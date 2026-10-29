import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';
import {allowedRequest, createTransport} from '../bridge/core.mjs';

const range = {from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z'};
function fixture(handle) {
  let n = 0;
  const context = new CommandContext(() => ({generation: 'g', accountId: 'a1', projectId: 'p1',
    schemaProjectId: 'p1', schemaGeneration: 1}), () => String(++n)); context.setMode('read-only');
  return new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {},
    audit: async () => ({accepted: true, requestId: 'safe'}), request: handle});
}
const find = {family: 'audit', resourceType: 'auditLog', auditFilters: range};
test('dedicated bridge adds exactly one typed audit route and pins verified revision', async () => {
  for (const [path, method] of [['pasturestack/ai-audit-queries?url=x', 'POST'], ['pasturestack/ai-audit-queries/extra', 'POST'],
    ['pasturestack/ai-audit-queries', 'GET'], ['pasturestack/audit-logs', 'GET'], ['auditlogs', 'GET'],
    ['pasturestack/key-audit-logs', 'GET'], ['aiResourceViews', 'POST'], ['aiAuditQueries', 'POST']])
    assert.equal(allowedRequest(path, method, 'p1'), false, path);
  let calls = 0;
  const request = createTransport({endpoint: 'http://127.0.0.1:8080', accessKey: 'private-access', secretKey: 'private-secret'}, async (url, options) => {
    assert.equal(url.pathname, calls ? '/v2-beta/pasturestack/ai-audit-queries' : '/v2-beta/projects');
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    if (calls++) assert.equal(options.headers['X-PastureStack-Key-Expected-Revision'], '3');
    return new Response('{}', {headers: {'X-PastureStack-Key-Purpose': 'ai-bridge', 'X-PastureStack-Key-Revision': '3'}});
  });
  await request({url: 'projects'}, 'p1', true);
  await request({url: 'pasturestack/ai-audit-queries', method: 'POST', data: range}, 'p1');
  assert.equal(calls, 2);
});
test('stdio query and safe detail use unchanged frozen filter context without exposing IDs or payloads', async () => {
  const calls = [];
  const engine = fixture(async request => {
    calls.push(request); assert.equal(request.url, 'pasturestack/ai-audit-queries'); assert.equal(request.method, 'POST');
    return {body: {resourceType: 'auditLog', data: [{id: '1al10', type: 'auditLog', accountId: 'p1', created: '2026-10-01T12:00:00Z',
      payloadsIncluded: false, requestPayloadPresence: 'not_projected', responsePayloadPresence: 'not_projected'}],
    total: 1, nextOffset: null, range, payloadPolicy: 'HUMAN_ONLY_NATIVE_AUDIT_UI'}};
  });
  const result = await engine.execute('find_resources', find); assert.equal(result.status, 'succeeded');
  const detail = await engine.execute('get_resource', {resourceRef: result.items[0].resourceRef}); assert.equal(detail.status, 'succeeded');
  assert.equal(calls.length, 2); assert.equal(calls[1].data.eventId, '1al10');
  assert.equal(JSON.stringify([result, detail]).includes('1al10'), false); assert.equal(detail.fields.payloadsIncluded, false);
});
test('canonical query denial, narrow query, audit failure and unknown errors keep distinct bounded public results', async () => {
  for (const [status, code, expected] of [[403, 'AuditQueryDenied', 'FORBIDDEN'], [422, 'AuditQueryNarrowQuery', 'INVALID_INPUT'],
    [503, 'AuditQueryAuditUnavailable', 'UNAVAILABLE'], [503, 'AuditQueryUnavailable', 'UNAVAILABLE']]) {
    const engine = fixture(async () => { throw {status, body: {code, message: 'PRIVATE-UPSTREAM'}}; });
    const result = await engine.execute('find_resources', find);
    assert.equal(result.code, expected); assert.notEqual(result.status, 'succeeded');
    if (code === 'AuditQueryAuditUnavailable') assert.match(result.nextStep, /audit evidence/);
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  }
});
