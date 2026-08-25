import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { module, test } from 'qunit';

import HostContainersRoute from 'ui/host/containers/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | host containers');

test('model follows the selected host instances relationship before rendering', function(assert) {
  assert.expect(6);

  let instances = A([
    EmberObject.create({id: '1i1'}),
    EmberObject.create({id: '1i2'}),
  ]);
  let host = EmberObject.create({
    id: '1h1',
    followLink(name) {
      assert.equal(name, 'instances', 'uses the API-provided host relationship');
      return Promise.resolve(instances);
    },
  });
  let route = createOwned(HostContainersRoute, {
    modelFor(name) {
      assert.equal(name, 'host');
      return EmberObject.create({host});
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
