import { module, test } from 'qunit';

import Ember from 'ember';
import BackupTargetsRoute from 'ui/backuptargets/route';

module('Unit | Route | backuptargets');

test('it exists', function(assert) {
  let route = BackupTargetsRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model loads all backup targets', function(assert) {
  assert.expect(2);

  let targets = [{ id: 'bt1' }];
  let route = BackupTargetsRoute.create({
    store: {
      findAll(type) {
        assert.equal(type, 'backuptarget');
        return Promise.resolve(targets);
      },
    },
  });

  return route.model().then((result) => {
    assert.strictEqual(result, targets);
    Ember.run(() => route.destroy());
  });
});
