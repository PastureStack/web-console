import Ember from 'ember';
import { module, test } from 'qunit';

import {
  classifyUnusedVolumes,
  hasActiveMount,
  isDetachedUnusedVolume,
  isUnusedTestVolume,
  runWithConcurrency,
} from 'ui/utils/unused-volume-cleanup';

module('Unit | Utility | unused volume cleanup');

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

test('it selects only detached test volumes with a remove action and no active mount', function(assert) {
  let candidate = volume();

  assert.ok(isDetachedUnusedVolume(candidate));
  assert.ok(isUnusedTestVolume(candidate));
  assert.notOk(isUnusedTestVolume(volume({state: 'active'})));
  assert.notOk(isUnusedTestVolume(volume({actionLinks: {}})));
  assert.notOk(isUnusedTestVolume(volume({instanceId: '1i1'})));
  assert.notOk(isUnusedTestVolume(volume({
    mounts: [Ember.Object.create({state: 'active', removed: null})],
  })));
});

test('it protects recovery names and ambiguous detached volumes', function(assert) {
  let safe = volume({name: 'pasturestack-final-e2e-cattle'});
  let recovery = volume({name: 'pasturestack-smoke-restore-cattle'});
  let ambiguous = volume({name: 'customer-data'});
  let classification = classifyUnusedVolumes([safe, recovery, ambiguous]);

  assert.deepEqual(classification.candidates, [safe]);
  assert.deepEqual(classification.protected, [recovery, ambiguous]);
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
