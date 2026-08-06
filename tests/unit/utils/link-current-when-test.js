import { module, test } from 'qunit';

import linkCurrentWhen from 'ui/utils/link-current-when';

module('Unit | Utility | link current when');

test('keeps the target route active for its related navigation routes', function(assert) {
  assert.equal(
    linkCurrentWhen('swarm-tab', ['stacks', 'service']),
    'stacks service swarm-tab'
  );
  assert.equal(linkCurrentWhen('catalog-tab'), 'catalog-tab');
  assert.equal(linkCurrentWhen(null, null), '');
});
