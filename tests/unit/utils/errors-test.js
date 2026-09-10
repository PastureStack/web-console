import { module, test } from 'qunit';
import Errors from 'ui/utils/errors';

module('Unit | Utility | errors');

test('extracts useful messages from API and XHR error envelopes', function(assert) {
  assert.strictEqual(
    Errors.stringify({body: '{"message":"OIDC discovery failed"}'}),
    'OIDC discovery failed',
    'a JSON response body is decoded'
  );
  assert.strictEqual(
    Errors.stringify({xhr: {responseJSON: {detail: 'Issuer does not match'}}}),
    'Issuer does not match',
    'a nested XHR API detail is shown'
  );
  assert.strictEqual(
    Errors.stringify({statusText: 'Bad Gateway'}),
    'Bad Gateway',
    'the HTTP status text is a safe final explanation'
  );
  assert.strictEqual(Errors.stringify({}), null, 'unknown objects do not become blank-looking object text');
});

test('finds authentication status codes in nested request failures', function(assert) {
  assert.strictEqual(Errors.status({status: 401}), 401, 'a direct status is found');
  assert.strictEqual(Errors.status({xhr: {status: 403}}), 403, 'an XHR status is found');
  assert.strictEqual(Errors.status({body: '{"status":502}'}), 502, 'a JSON body status is found');
  assert.strictEqual(Errors.status({xhr: {status: 0}}), null, 'a network failure is not authentication failure');
});
