import { module, test } from 'qunit';
import { localizedMfaError, mfaErrorCode } from 'ui/utils/mfa-error';

module('Unit | Utility | mfa error');

const intl = {t: (key) => `localized:${key}`};

test('reads the JSON error code before a generic transport type', function(assert) {
  const err = {type: 'error', body: JSON.stringify({
    status: 401, code: 'MfaReauthenticationRequired',
  })};
  assert.strictEqual(mfaErrorCode(err), 'MfaReauthenticationRequired');
});

test('unknown API failure keeps localization and safe HTTP diagnostics', function(assert) {
  assert.strictEqual(localizedMfaError({type: 'error', body: {
    status: 405, code: 'Method not allowed', message: 'private server details',
  }}, intl, 'authPage.mfa.error.generic'),
  'localized:authPage.mfa.error.generic (HTTP 405; Method not allowed)');
});

test('known MFA errors retain their specific localized message', function(assert) {
  assert.strictEqual(localizedMfaError({body: {code: 'MfaVerificationFailed'}}, intl),
    'localized:loginPage.mfa.error.invalid');
});

test('HTML and unbounded diagnostic fields never reach the UI', function(assert) {
  for (const err of [
    {status: 502, body: '<html>secret</html>', message: 'secret'},
    {status: 502, body: {code: '<script>secret</script>', detail: 'secret'}},
    {status: 502, body: {code: 'x'.repeat(200), message: 'secret'}},
  ]) {
    assert.strictEqual(localizedMfaError(err, intl),
      'localized:loginPage.mfa.error.invalid (HTTP 502)');
  }
});

test('supports xhr JSON errors and fallback-only network failures', function(assert) {
  assert.strictEqual(mfaErrorCode({xhr: {responseJSON: {code: 'MfaReauthenticationRequired'}}}),
    'MfaReauthenticationRequired');
  assert.strictEqual(localizedMfaError(null, intl), 'localized:loginPage.mfa.error.invalid');
});
