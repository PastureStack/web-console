import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import BackupTargetsRoute from 'ui/backuptargets/route';

module('Unit | Route | backuptargets');

test('it exists', function(assert) {
  let route = BackupTargetsRoute.create();
  assert.ok(route);
  run(() => route.destroy());
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
    run(() => route.destroy());
  });
});
