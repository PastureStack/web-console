import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import OidcConfig from 'ui/models/oidcconfig';

module('Unit | Model | oidcconfig');

test('keeps the provider display name writable on the shared resource runtime', function(assert) {
  let config = OidcConfig.create({
    displayName: 'Corporate identity',
    type: 'oidcconfig',
  });

  assert.equal(config.get('displayName'), 'Corporate identity');
  config.set('displayName', 'OpenID Connect');
  assert.equal(config.get('displayName'), 'OpenID Connect');

  run(() => config.destroy());
});
