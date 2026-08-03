import { module, test } from 'qunit';

import Ember from 'ember';
import HostContainersRoute from 'ui/host/containers/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | host containers');

test('model follows the selected host instances relationship before rendering', function(assert) {
  assert.expect(6);

  let instances = Ember.A([
    Ember.Object.create({id: '1i1'}),
    Ember.Object.create({id: '1i2'}),
  ]);
  let host = Ember.Object.create({
    id: '1h1',
    followLink(name) {
      assert.equal(name, 'instances', 'uses the API-provided host relationship');
      return Promise.resolve(instances);
    },
  });
  let route = createOwned(HostContainersRoute, {
    modelFor(name) {
      assert.equal(name, 'host');
      return Ember.Object.create({host});
    },
  }, 'route');

  return route.model().then((result) => {
    assert.strictEqual(result.get('host'), host, 'retains the existing host model');
    assert.strictEqual(result.get('instances'), instances, 'renders the exact relationship response');
    assert.equal(result.get('instances.length'), 2, 'does not depend on project-wide Store contents');
    assert.equal(host.get('id'), '1h1', 'does not replace the host model');
    destroyOwned(route);
  });
});
