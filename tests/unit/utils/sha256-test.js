import { module, test } from 'qunit';
import sha256Ascii from 'ui/utils/sha256';

module('Unit | Utility | sha256');

function base64Url(bytes) {
  let binary = '';
  for ( let i = 0 ; i < bytes.length ; i++ ) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

test('matches the RFC 7636 S256 example', function(assert) {
  let verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.strictEqual(
    base64Url(sha256Ascii(verifier)),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  );
});

test('rejects non-ASCII input', function(assert) {
  assert.throws(() => sha256Ascii('繁體中文'), /ASCII/);
});
