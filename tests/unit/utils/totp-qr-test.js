import { module, test } from 'qunit';
import { totpProvisioningQr } from 'ui/utils/totp-qr';

module('Unit | Utility | totp qr');

test('renders an accessible local SVG without exposing the provisioning URI in markup', function(assert) {
  let uri = 'otpauth://totp/PastureStack:test?secret=JBSWY3DPEHPK3PXP&issuer=PastureStack';
  let output = totpProvisioningQr(uri, 'Authenticator setup QR code');
  let svg = output && output.toString();

  assert.ok(svg, 'a QR code is generated from the locally loaded library');
  assert.ok(svg.indexOf('<svg') >= 0, 'the output is SVG');
  assert.ok(svg.indexOf('role="img"') >= 0, 'the SVG has an image role');
  assert.ok(svg.indexOf('Authenticator setup QR code') >= 0, 'the accessible label is present');
  assert.notOk(svg.indexOf(uri) >= 0, 'the provisioning URI is encoded as modules, not printed');
});

test('does not generate an empty QR code', function(assert) {
  assert.strictEqual(totpProvisioningQr('', 'Authenticator setup QR code'), null);
});
