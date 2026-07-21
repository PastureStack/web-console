import { module, test } from 'qunit';

import Ember from 'ember';
import ContainerPortsRoute from 'ui/container/ports/route';

module('Unit | Route | container/ports');

test('it exists', function(assert) {
  var route = ContainerPortsRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model loads ports from the parent container', function(assert) {
  assert.expect(4);

  var ports = [{ privatePort: 80 }];
  var container = {
    id: '1i1',
    followLink(name) {
      assert.equal(name, 'ports');
      return Promise.resolve(ports);
    },
  };
  var route = ContainerPortsRoute.create({
    modelFor(name) {
      assert.equal(name, 'container');
      return container;
    },
  });

  return route.model().then((result) => {
    assert.strictEqual(result.container, container);
    assert.strictEqual(result.ports, ports);
    Ember.run(() => route.destroy());
  });
});
