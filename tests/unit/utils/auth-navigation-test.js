import { module, test } from 'qunit';
import { isAuthenticationPath, safeInternalTarget } from 'ui/utils/auth-navigation';

module('Unit | Utility | auth-navigation');

test('accepts same-origin application paths and rejects external or credential-bearing returns', function(assert) {
  let origin = 'https://stack.example.test';
  assert.strictEqual(safeInternalTarget('/env/1a5/apps?which=infra', origin),
    '/env/1a5/apps?which=infra', 'an internal system path is retained');
  assert.strictEqual(safeInternalTarget('https://stack.example.test/admin/accounts#active', origin),
    '/admin/accounts#active', 'an absolute same-origin path is normalized');
  assert.strictEqual(safeInternalTarget('https://attacker.example/collect', origin), null,
    'an external origin is rejected');
  assert.strictEqual(safeInternalTarget('/login/oidc-auth?code=secret&state=opaque', origin), null,
    'OIDC material is never copied into a return URL');
  assert.strictEqual(safeInternalTarget('/login?token=secret', origin), null,
    'tokens are never copied into a return URL');
  assert.ok(isAuthenticationPath('/login/oidc-auth'), 'OIDC callback paths are authentication paths');
  assert.ok(isAuthenticationPath('/logout'), 'logout is an authentication path');
  assert.notOk(isAuthenticationPath('/admin/accounts'), 'normal authenticated paths remain eligible');
});
