import { module, test } from 'qunit';
import auditQueryError, { auditQueryError as namedAuditQueryError, isAuthenticationFailure } from 'ui/utils/audit-query-error';

module('Unit | Utility | audit query error');

const key = (name) => `auditLogsPage.queryErrors.${name}`;

test('maps bounded query and export failures without returning response bodies', function(assert) {
  assert.strictEqual(namedAuditQueryError, auditQueryError, 'named and default exports have the same contract');
  for (let [code, name] of [['result_set_too_large', 'tooLarge'], ['export_too_large', 'exportTooLarge']]) {
    let error = {status: 422, body: {code, message: '<private backend details>', total: 0}};
    assert.deepEqual(auditQueryError(error), {messageKey: key(name), canNarrow: true, status: 422, code});
    assert.strictEqual(error.body.message, '<private backend details>', 'the original error is not mutated');
  }
});

test('maps only established range codes including the existing client validation code', function(assert) {
  for (let code of ['invalid_time_scope', 'incomplete_time_range', 'invalid_time_range', 'time_range_too_large', 'InvalidAuditRange']) {
    assert.deepEqual(auditQueryError({body: JSON.stringify({status: 400, code})}),
      {messageKey: key('invalidRange'), canNarrow: true, status: 400, code}, code);
  }
});

test('accepts rawRequest, XHR, nested transport and Ember get envelopes', function(assert) {
  for (let error of [
    {statusCode: '422', body: {code: 'result_set_too_large'}},
    {xhr: {status: 422, responseJSON: {code: 'result_set_too_large'}}},
    {xhr: {status: 422, responseText: '{"code":"result_set_too_large"}'}},
    {response: {status: 422, data: {code: 'result_set_too_large'}}},
    {get(name) { return {status: 422, body: {code: 'result_set_too_large'}}[name]; }},
  ]) {
    assert.deepEqual(auditQueryError(error),
      {messageKey: key('tooLarge'), canNarrow: true, status: 422, code: 'result_set_too_large'});
  }
});

test('403 takes precedence over narrowing copy and unknown codes are withheld', function(assert) {
  assert.deepEqual(auditQueryError({status: 403, body: {code: 'result_set_too_large'}}),
    {messageKey: key('forbidden'), canNarrow: false, status: 403, code: 'result_set_too_large'});
  assert.deepEqual(auditQueryError({xhr: {status: 403, responseJSON: {code: 'environment_denied'}}}),
    {messageKey: key('forbidden'), canNarrow: false, status: 403, code: null});
});

test('export context changes only forbidden and unavailable presentation, never authentication or range semantics', function(assert) {
  for (let [error, name, status] of [
    [{status: 403, body: {code: 'result_set_too_large'}}, 'exportForbidden', 403],
    [{status: 502, body: {code: 'upstream_failed'}}, 'exportUnavailable', 502],
    [new TypeError('synthetic network failure'), 'exportUnavailable', null],
  ]) {
    let result = auditQueryError(error, 'export');
    assert.strictEqual(result.messageKey, key(name));
    assert.strictEqual(result.status, status);
    assert.false(result.canNarrow, 'permission and unavailable errors never offer narrowing');
    assert.deepEqual(Object.keys(result).sort(), ['canNarrow', 'code', 'messageKey', 'status']);
  }
  for (let status of [403, 502]) {
    assert.deepEqual(auditQueryError({status}), auditQueryError({status}, 'query'), 'default query copy is unchanged');
    assert.deepEqual(auditQueryError({status}, 'unknown'), auditQueryError({status}), 'an unknown context cannot change the query contract');
  }
  assert.strictEqual(auditQueryError({status: 401}, 'export'), null, 'export 401 stays at the session recovery boundary');
  for (let code of ['result_set_too_large', 'export_too_large', 'invalid_time_scope', 'incomplete_time_range',
    'invalid_time_range', 'time_range_too_large', 'InvalidAuditRange']) {
    let error = {status: 422, body: {code}};
    assert.deepEqual(auditQueryError(error, 'export'), auditQueryError(error), `${code}: existing range/limit semantics are unchanged`);
  }
});

test('401 is never converted to a query or empty-result presentation', function(assert) {
  for (let error of [
    {status: 401, body: {code: 'result_set_too_large'}},
    {statusCode: '401'},
    {body: '{"status":401}'},
    {xhr: {status: 401}},
    {response: {status: 401}},
    {get(name) { return name === 'status' ? 401 : undefined; }},
  ]) {
    assert.true(isAuthenticationFailure(error), 'the caller can rethrow to session recovery');
    assert.strictEqual(auditQueryError(error), null, 'no localized query failure replaces authentication recovery');
  }
  assert.false(isAuthenticationFailure({status: 403, body: {status: 401}}), 'outer transport status is authoritative');
  assert.false(isAuthenticationFailure({status: 0}), 'network failures are not authentication failures');
});

test('unknown, malformed and HTML errors use reviewed unavailable copy only', function(assert) {
  for (let error of [
    null, undefined, '<html>private response</html>',
    {status: 0, body: 'not JSON'},
    {status: 502, body: '<html>private response</html>', message: 'private response'},
    {status: 400, body: {code: 'invalid_sort', detail: 'private response'}},
    {status: 422, code: 'result_set_too_large private response'},
    {status: 422, code: '<script>private response</script>'},
    {status: 422, code: 'constructor'},
    {status: 422, code: 'x'.repeat(200)},
    {body: '{"code":'},
    {body: ' '.repeat(65537)},
  ]) {
    let failure = auditQueryError(error);
    assert.strictEqual(failure.messageKey, key('unavailable'));
    assert.strictEqual(failure.code, null);
    assert.false(failure.canNarrow);
    assert.deepEqual(Object.keys(failure).sort(), ['canNarrow', 'code', 'messageKey', 'status'], 'no message/body/detail escapes');
  }
});

test('never reads raw diagnostic text and returns only valid bounded HTTP status', function(assert) {
  let error = {status: 503, body: {code: 'future_backend_code'}};
  for (let field of ['message', 'detail', 'statusText', 'headers']) {
    Object.defineProperty(error, field, {get() { throw new Error('raw diagnostic field must not be read'); }});
    Object.defineProperty(error.body, field, {get() { throw new Error('raw diagnostic field must not be read'); }});
  }
  assert.deepEqual(auditQueryError(error), {messageKey: key('unavailable'), canNarrow: false, status: 503, code: null});
  for (let status of [0, true, {}, [], NaN, Infinity, 401.5, 600, '401 private response']) {
    assert.strictEqual(auditQueryError({status}).status, null, 'malformed status is withheld');
  }
});

test('cyclic and deeply nested failures are bounded and do not mutate their input', function(assert) {
  let error = {status: 502};
  error.body = error;
  assert.deepEqual(auditQueryError(error), {messageKey: key('unavailable'), canNarrow: false, status: 502, code: null});
  assert.strictEqual(error.body, error, 'the original cycle is intact');
  let deep = {body: {body: {body: {body: {body: {status: 401, code: 'export_too_large'}}}}}};
  assert.deepEqual(auditQueryError(deep), {messageKey: key('unavailable'), canNarrow: false, status: null, code: null});
});

test('English and Traditional Chinese query failure/action keys are symmetric and human readable', async function(assert) {
  let names = ['tooLarge', 'exportTooLarge', 'invalidRange', 'forbidden', 'unavailable', 'exportForbidden', 'exportUnavailable', 'recent15Minutes', 'retry',
    'selectedUserUnavailable', 'selectedEnvironmentUnavailable', 'exporting'];
  let selectedAndExportCopy = {
    'en-us': ['A user is selected; its name is temporarily unavailable.',
      'An environment is selected; its name is temporarily unavailable.', 'Preparing export…'],
    'zh-tw': ['已指定使用者，目前無法載入名稱。', '已指定環境，目前無法載入名稱。', '正在準備匯出…'],
  };
  for (let locale of ['en-us', 'zh-tw']) {
    let response = await fetch(`/translations/${locale}.json`);
    assert.ok(response.ok, `${locale} translations are available`);
    let messages = await response.json();
    for (let name of names) {
      assert.strictEqual(typeof messages[key(name)], 'string', `${locale} ${name} is translated`);
      assert.ok(messages[key(name)].length > 0, `${locale} ${name} has reviewed copy`);
    }
    ['selectedUserUnavailable', 'selectedEnvironmentUnavailable', 'exporting'].forEach((name, index) => {
      assert.strictEqual(messages[key(name)], selectedAndExportCopy[locale][index], `${locale} ${name} preserves the selected-filter or export state`);
    });
    assert.ok(messages[key('tooLarge')].includes(locale === 'en-us' ? 'not complete' : '未完成'), 'failure is not presented as zero records');
    assert.ok(messages[key('unavailable')].includes(locale === 'en-us' ? 'no records' : '沒有記錄'), 'unavailable copy explains that records are not known to be absent');
    for (let name of ['exportForbidden', 'exportUnavailable']) {
      assert.ok(messages[key(name)].includes(locale === 'en-us' ? 'export did not complete' : '匯出未完成'), 'standalone export failures identify the failed operation');
      assert.notOk(messages[key(name)].includes(locale === 'en-us' ? 'query did not complete' : '查詢未完成'), 'successful query results are not described as failed');
    }
  }
});
