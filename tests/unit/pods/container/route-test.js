import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import ContainerRoute from 'ui/container/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | container');

test('it exists', function(assert) {
  var route = ContainerRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('model loads the requested container', function(assert) {
  assert.expect(3);

  var container = { id: '1i1' };
  var route = createOwned(ContainerRoute, {
    store: {
      find(type, id) {
        assert.equal(type, 'container');
        assert.equal(id, '1i1');
        return container;
      },
    },
  }, 'route');

  assert.strictEqual(route.model({ container_id: '1i1' }), container);
  destroyOwned(route);
});
