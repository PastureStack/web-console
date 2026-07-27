import { module, test } from 'qunit';

import Ember from 'ember';
import StoragePoolsRoute from 'ui/storagepools/pools/route';

module('Unit | Route | storagepools/pools');

test('it exists', function(assert) {
  let route = StoragePoolsRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model wraps the parent storagepools model', function(assert) {
  let pools = [{ id: 'sp1' }];
  let route = StoragePoolsRoute.create({
    modelFor(name) {
      assert.equal(name, 'storagepools');
      return pools;
    },
  });
  let model = route.model();

  assert.strictEqual(model.get('all'), pools);
  Ember.run(() => route.destroy());
});
