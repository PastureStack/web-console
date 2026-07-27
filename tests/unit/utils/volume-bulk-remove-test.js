import Ember from 'ember';
import { module, test } from 'qunit';

import {
  filterVolumesByState,
  hasActiveMount,
  isBulkRemovableVolume,
  runWithConcurrency,
} from 'ui/utils/volume-bulk-remove';

module('Unit | Utility | volume bulk remove');

function volume(overrides={}) {
  return Ember.Object.create(Object.assign({
    state: 'detached',
    removed: null,
    instanceId: null,
    name: 'pasturestack-smoke-cattle',
    actionLinks: {remove: '/volumes/1?action=remove'},
    mounts: [],
  }, overrides));
}

test('it allows the operator to select any detached removable volume', function(assert) {
  let ordinary = volume({name: 'customer-data'});
  let recovery = volume({name: 'pasturestack-backup-current'});

  assert.ok(isBulkRemovableVolume(ordinary), 'ambiguous names are available for explicit selection');
  assert.ok(isBulkRemovableVolume(recovery), 'names do not silently override an operator selection');
  assert.notOk(isBulkRemovableVolume(volume({state: 'active'})));
  assert.notOk(isBulkRemovableVolume(volume({actionLinks: {}})));
  assert.notOk(isBulkRemovableVolume(volume({instanceId: '1i1'})));
  assert.notOk(isBulkRemovableVolume(volume({
    mounts: [Ember.Object.create({state: 'active', removed: null})],
  })));
});

test('it filters by visible state without changing removal eligibility', function(assert) {
  let active = volume({id: 'active', state: 'active'});
  let detached = volume({id: 'detached'});
  let unavailable = volume({id: 'unavailable', actionLinks: {}});
  let list = [active, detached, unavailable];

  assert.deepEqual(filterVolumesByState(list, 'all'), list);
  assert.deepEqual(filterVolumesByState(list, 'active'), [active]);
  assert.deepEqual(filterVolumesByState(list, 'detached'), [detached, unavailable]);
  assert.deepEqual(filterVolumesByState(list, 'removable'), [detached]);
  assert.ok(hasActiveMount(volume({
    mounts: [Ember.Object.create({state: 'active', removed: null})],
  })));
});

test('it runs bounded work and waits for every item', function(assert) {
  let active = 0;
  let peak = 0;
  let seen = [];

  return runWithConcurrency([1, 2, 3, 4, 5], 2, (item) => {
    active++;
    peak = Math.max(peak, active);

    return new Ember.RSVP.Promise((resolve) => {
      Ember.run.later(() => {
        seen.push(item);
        active--;
        resolve();
      }, 5);
    });
  }).then(() => {
    assert.equal(peak, 2, 'concurrency is bounded');
    assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5], 'all items finish');
  });
});
