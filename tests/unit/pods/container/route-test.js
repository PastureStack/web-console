import { module, test } from 'qunit';

import Ember from 'ember';
import ContainerRoute from 'ui/container/route';

module('Unit | Route | container');

test('it exists', function(assert) {
  var route = ContainerRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model loads the requested container', function(assert) {
  assert.expect(3);

  var container = { id: '1i1' };
  var route = ContainerRoute.create({
    store: {
      find(type, id) {
        assert.equal(type, 'container');
        assert.equal(id, '1i1');
        return container;
      },
    },
  });

  assert.strictEqual(route.model({ container_id: '1i1' }), container);
  Ember.run(() => route.destroy());
});
