import EmberObject from '@ember/object';
import { cancel, run } from '@ember/runloop';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';

import Service from 'ui/models/service';

module('Unit | Model | service scale');

function projectContext() {
  return {
    'tab-session': EmberObject.create({projectId: '1a21'}),
    projects: EmberObject.create({
      current: EmberObject.create({id: '1a21'}),
      schemaProjectId: '1a21',
    }),
  };
}

test('quick scale buttons PUT only the latest scale', async function(assert) {
  const requests = [];
  function makeService(id) {
    return Service.create({
      ...projectContext(),
      id,
      type: 'service',
      links: {self: `/v1/services/${id}`},
      actionLinks: {update: `/v1/services/${id}`},
      intl: {t(key) { return key; }},
      scale: 2,
      launchConfig: {imageUuid: 'docker:example', volumeDriver: ''},
      upgrade: {inServiceStrategy: {batchSize: 1}},
      request(options) {
        requests.push({id, method: options.method, url: options.url, data: options.data});
        return resolve(null);
      },
    });
  }
  const scaleUp = makeService('1s-up');
  const scaleDown = makeService('1s-down');

  run(() => {
    scaleUp.send('scaleUp');
    scaleUp.send('scaleUp');
    scaleDown.send('scaleDown');
  });
  await new Promise((resolve) => setTimeout(resolve, 600));

  assert.strictEqual(scaleUp.get('scale'), 4);
  assert.strictEqual(scaleDown.get('scale'), 1);
  assert.deepEqual(requests, [
    {id: '1s-up', method: 'PUT', url: '/v1/services/1s-up', data: {scale: 4}},
    {id: '1s-down', method: 'PUT', url: '/v1/services/1s-down', data: {scale: 1}},
  ], 'both buttons send bounded PUTs, and rapid clicks keep the final scale');
  assert.deepEqual(scaleUp.get('launchConfig'), {imageUuid: 'docker:example', volumeDriver: ''});
  assert.deepEqual(scaleDown.get('upgrade'), {inServiceStrategy: {batchSize: 1}});
  run(() => {
    scaleUp.destroy();
    scaleDown.destroy();
  });
});

test('readonly service displays its scale but cannot submit scale writes', function(assert) {
  let calls = 0;
  let resource = Service.create({
    ...projectContext(),
    id: '1s-readonly', type: 'service', scale: 2,
    actionLinks: {},
    saveScale() { calls++; },
  });

  assert.false(resource.get('canScale'));
  resource.send('scaleUp');
  resource.send('scaleDown');
  assert.strictEqual(resource.get('scale'), 2, 'the readonly value is unchanged');
  assert.strictEqual(calls, 0, 'neither button path attempts a write');

  resource.set('actionLinks', {update: '/v1/services/1s-readonly'});
  assert.true(resource.get('canScale'), 'the same service can scale when its ID advertises update');
  resource.set('scale', 1);
  resource.send('scaleDown');
  assert.strictEqual(resource.get('scale'), 1, 'scale down never crosses the visible minimum');
  assert.strictEqual(calls, 0);
  resource.destroy();
});

test('a queued scale write rechecks the instance permission before PUT', async function(assert) {
  let writes = 0;
  let notices = [];
  let resource = Service.create({
    ...projectContext(),
    id: '1s-queued', type: 'service', scale: 3,
    actionLinks: {update: '/v1/services/1s-queued'},
    intl: {t(key) { return key; }},
    growl: {fromError(title, error) { notices.push({title, status: error.status}); }},
    save() {
      writes++;
      return resolve();
    },
  });

  resource.set('actionLinks', {});
  await resource.persistScale();
  assert.strictEqual(writes, 0, 'a permission removed before debounce fires never writes');
  assert.deepEqual(notices, [{title: 'resourceSaveError.scaleFailed', status: 403}],
    'the user receives a localized permission explanation');

  resource.set('actionLinks', {update: '/v1/services/1s-queued'});
  await resource.persistScale();
  assert.strictEqual(writes, 1, 'the authorized instance can submit');
  resource.destroy();
});

test('a denied scale submit restores the last saved value and remains retryable', async function(assert) {
  let notices = [];
  let requests = 0;
  let resource = Service.create({
    ...projectContext(),
    id: '1s-rejected', type: 'service', scale: 4, scaleBeforePending: 2,
    actionLinks: {update: '/v1/services/1s-rejected'},
    intl: {t(key) { return key; }},
    growl: {fromError(title, error) { notices.push({title, status: error.status}); }},
    save() {
      requests++;
      throw {status: 422};
    },
  });

  assert.false(await resource.persistScale(), 'a synchronous save failure is handled');
  assert.strictEqual(requests, 1);
  assert.strictEqual(resource.get('scale'), 2, 'the unsaved value is not left on screen');
  assert.strictEqual(resource.get('scaleBeforePending'), null);
  assert.false(resource.get('scaleSaving'));
  assert.true(resource.get('canScale'), 'the same button is usable after correction');
  assert.deepEqual(notices, [{title: 'resourceSaveError.scaleFailed', status: 422}]);
  resource.destroy();
});

test('an in-flight scale submit owns its value and blocks duplicate clicks', async function(assert) {
  let pending = defer();
  let requests = 0;
  let resource = Service.create({
    ...projectContext(),
    id: '1s-pending', type: 'service', scale: 4, scaleBeforePending: 2,
    actionLinks: {update: '/v1/services/1s-pending'},
    intl: {t(key) { return key; }},
    save() {
      requests++;
      return pending.promise;
    },
  });

  let result = resource.persistScale();
  assert.false(resource.get('canScale'), 'the button is disabled during the request');
  resource.send('scaleUp');
  resource.send('scaleDown');
  assert.strictEqual(resource.get('scale'), 4, 'duplicate clicks cannot change the in-flight value');
  pending.resolve();
  assert.true(await result);
  assert.strictEqual(requests, 1, 'one server write for the debounced value');
  assert.strictEqual(resource.get('scale'), 4);
  assert.strictEqual(resource.get('scaleBeforePending'), null);
  assert.true(resource.get('canScale'));
  resource.destroy();
});

test('a queued scale click cannot write after switching projects', async function(assert) {
  let writes = 0;
  const notices = [];
  const resource = Service.create({
    ...projectContext(),
    id: '1s-old', type: 'service', scale: 2,
    actionLinks: {update: '/v1/services/1s-old'},
    intl: {t(key) { return key; }},
    growl: {fromError(title, error) { notices.push({title, status: error.status}); }},
    save() { writes++; return resolve(); },
  });
  resource.send('scaleUp');
  assert.strictEqual(resource.get('scale'), 3, 'the click has a local pending value');
  assert.strictEqual(resource.get('scaleRequestProjectId'), '1a21');
  cancel(resource.get('scaleTimer'));
  resource.set('scaleTimer', null);
  resource.get('tab-session').set('projectId', '1a22');
  resource.get('projects').setProperties({
    current: EmberObject.create({id: '1a22'}),
    schemaProjectId: '1a22',
  });

  assert.false(await resource.persistScale());
  assert.strictEqual(writes, 0, 'the queued click cannot submit against the old project');
  assert.strictEqual(resource.get('scale'), 2, 'the unsaved value is restored');
  assert.deepEqual(notices, [{title: 'resourceSaveError.scaleFailed', status: 403}]);
  resource.destroy();
});
