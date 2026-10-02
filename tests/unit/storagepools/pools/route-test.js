import { run } from '@ember/runloop';
import EmberObject from '@ember/object';

import { module, test } from 'qunit';
import StoragePoolsRoute from 'ui/storagepools/pools/route';
import { volumeFixture } from '../../utils/unallocated-volumes-test';

module('Unit | Route | storagepools/pools');

test('it exists', function(assert) {
  let route = StoragePoolsRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('model wraps the parent storagepools model', async function(assert) {
  let fixture = volumeFixture();
  let projects = EmberObject.create({current: {id: '1a2540'}});
  let pools = [{ id: 'sp1' }];
  let route = StoragePoolsRoute.create({
    store: fixture.store,
    projects,
    intl: {t(key) { return key; }},
    modelFor(name) {
      assert.equal(name, 'storagepools');
      return pools;
    },
  });
  try {
    let model = await route.model();
    assert.strictEqual(model.get('all'), pools);
    assert.strictEqual(model.get('volumes'), fixture.store.all('volume'));
    assert.strictEqual(model.get('mounts'), fixture.store.all('mount'));
  } finally {
    run(() => { route.destroy(); projects.destroy(); fixture.dispose(); });
  }
});
