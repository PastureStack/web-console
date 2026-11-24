import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewBalancerRoute from 'ui/service/new-balancer/route';

module('Unit | Route | new balancer candidate');

function fixture(candidate) {
  let copied = EmberObject.create({launchConfig: EmberObject.create({imageUuid: 'docker:custom/lb:pinned'})});
  let existing = EmberObject.create({id: '1s1', stackId: '1st1', imageUpgradeCandidate: candidate,
    clone() { return copied; }, cloneForNew() { return copied; },
  });
  let calls = [];
  let route = NewBalancerRoute.create({
    store: {findAll() { return resolve([]); }, find() { return resolve(existing); }},
    intl: {t(key) { return key; }}, growl: {error(...args) { calls.push(['error', ...args]); }},
    router: {replaceWith(...args) { calls.push(['replace', ...args]); return 'redirected'; }},
  });
  return {route, existing, copied, calls};
}

test('direct update URL cannot replace an unavailable or custom image', async function(assert) {
  let f = fixture(null);
  assert.strictEqual(await f.route.model({serviceId: '1s1', upgrade: 'true', upgradeImage: 'true'}), 'redirected');
  assert.strictEqual(f.copied.get('launchConfig.imageUuid'), 'docker:custom/lb:pinned');
  assert.deepEqual(f.calls, [
    ['error', 'routePermission.title', 'servicePage.newBalancer.upgradeImageUnavailable'],
    ['replace', 'service', '1st1', '1s1'],
  ]);
  f.route.destroy(); f.existing.destroy(); f.copied.destroy();
});

test('image update URL uses the same exact candidate and ordinary editing preserves its image', async function(assert) {
  let candidate = {to: 'ghcr.io/pasturestack/load-balancer-service:v0.9.35'};
  let f = fixture(candidate);
  let result = await f.route.model({serviceId: '1s1', upgrade: 'true', upgradeImage: 'true'});
  assert.strictEqual(result.service.get('launchConfig.imageUuid'), 'docker:' + candidate.to);
  assert.strictEqual(result.existing, f.existing);
  assert.deepEqual(f.calls, []);
  f.copied.set('launchConfig.imageUuid', 'docker:custom/lb:pinned');
  await f.route.model({serviceId: '1s1', upgrade: 'true', upgradeImage: 'false'});
  assert.strictEqual(f.copied.get('launchConfig.imageUuid'), 'docker:custom/lb:pinned');
  f.route.destroy(); f.existing.destroy(); f.copied.destroy();
});
