import { module, test } from 'qunit';

import Ember from 'ember';
import HostContainersRoute from 'ui/host/containers/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | host containers');

test('model loads only the selected host instances before rendering', function(assert) {
  assert.expect(5);

  let host = Ember.Object.create({id: '1h1'});
  let route = createOwned(HostContainersRoute, {
    modelFor(name) {
      assert.equal(name, 'host');
      return Ember.Object.create({host});
    },
    store: {
      findAll(type, options) {
        assert.equal(type, 'instance');
        assert.deepEqual(options, {filter: {hostId: '1h1'}});
        return Promise.resolve([]);
      },
    },
  }, 'route');

  return route.model().then((result) => {
    assert.strictEqual(result, host, 'returns the existing host after its instances load');
    assert.equal(host.get('id'), '1h1', 'does not replace the host model');
    destroyOwned(route);
  });
});
