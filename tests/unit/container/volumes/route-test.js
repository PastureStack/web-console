import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import ContainerVolumesRoute from 'ui/container/volumes/route';

module('Unit | Route | container/volumes');

test('it exists', function(assert) {
  var route = ContainerVolumesRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('model returns the parent container model', function(assert) {
  var container = { id: '1i1' };
  var route = ContainerVolumesRoute.create({
    modelFor(name) {
      assert.equal(name, 'container');
      return container;
    },
  });

  assert.strictEqual(route.model(), container);
  run(() => route.destroy());
});
