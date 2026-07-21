import { module, test } from 'qunit';

import { resolveAppName } from 'ui/services/settings';

module('Unit | Service | settings');

test('it always provides a product name when white-label data is absent', function(assert) {
  assert.equal(resolveAppName('', 'PastureStack', false), 'PastureStack');
  assert.equal(resolveAppName(null, 'PastureStack', false), 'PastureStack');
  assert.equal(resolveAppName('pasturestack', 'PastureStack', true), 'PastureStack');
  assert.equal(resolveAppName('Custom Platform', 'PastureStack', false), 'Custom Platform');
});
