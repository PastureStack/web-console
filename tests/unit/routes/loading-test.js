import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import LoadingRoute from 'ui/loading/route';

module('Unit | Route | loading');

test('it exists', function(assert) {
  var route = LoadingRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});
