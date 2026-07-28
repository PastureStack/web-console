import { module, test } from 'qunit';

import Ember from 'ember';
import HostsRoute from 'ui/hosts/route';

module('Unit | Route | hosts');

test('it exists', function(assert) {
  var route = HostsRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model returns hosts after loading instances', function(assert) {
  assert.expect(3);

  var hosts = [{ id: '1h1' }];
  var instances = [{ id: '1i1' }];
  var route = HostsRoute.create({
    store: {
      findAll(type) {
        if (type === 'host') {
          return Promise.resolve(hosts);
        }
        assert.equal(type, 'instance');
        return Promise.resolve(instances);
      },
    },
  });

  return route.model().then((result) => {
    assert.strictEqual(result, hosts);
    assert.deepEqual(instances, [{ id: '1i1' }]);
    Ember.run(() => route.destroy());
  });
});
