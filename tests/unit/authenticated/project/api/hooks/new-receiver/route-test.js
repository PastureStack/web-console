import { module, test } from 'qunit';
import NewReceiverRoute from 'ui/authenticated/project/api/hooks/new-receiver/route';
import { createOwned, destroyOwned } from '../../../../../../helpers/owned-subject';

module('Unit | Route | authenticated/project/api/hooks/new-receiver');

test('direct Add Receiver URL fails before loading or cloning a receiver without POST capability', async function(assert) {
  let reads = 0;
  let route = createOwned(NewReceiverRoute, {
    webhookStore: {
      canCreate(type) {
        assert.strictEqual(type, 'receiver');
        return false;
      },
      createRecord() { reads++; throw new Error('must not create a record'); },
      find() { reads++; throw new Error('must not fetch a clone source'); },
    },
    intl: {
      t(key) {
        return key === 'hookPage.receiver.buttonText' ? 'Add Receiver' :
          'You do not have permission to add receiver hooks in this environment.';
      },
    },
  }, 'route');

  try {
    await route.beforeModel();
    assert.ok(false, 'read-only users cannot enter the form');
  } catch (error) {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'Forbidden');
    assert.strictEqual(error.title, 'Add Receiver');
    assert.strictEqual(error.titleKey, 'hookPage.receiver.buttonText');
    assert.strictEqual(error.message, 'You do not have permission to add receiver hooks in this environment.');
    assert.strictEqual(error.messageKey, 'hookPage.receiver.permissionDenied');
  }
  assert.strictEqual(reads, 0, 'no receiver data was touched');
  destroyOwned(route);
});

test('a schema with POST permits the receiver form', async function(assert) {
  let route = createOwned(NewReceiverRoute, {
    webhookStore: {
      canCreate(type) {
        assert.strictEqual(type, 'receiver');
        return true;
      },
    },
  }, 'route');

  await route.beforeModel();
  assert.ok(true, 'the form may load for a creator');
  destroyOwned(route);
});

test('cloning a receiver keeps inert settings but never copies its URL or state', async function(assert) {
  let source = {type: 'receiver', name: 'source', url: 'existing-capability',
    state: 'active', driver: 'scaleHost',
    scaleHostConfig: {action: 'up', amount: 1, hostSelector: {qa: 'only'}}};
  let route = createOwned(NewReceiverRoute, {
    webhookStore: {
      find(type, id) {
        assert.strictEqual(type, 'receiver');
        assert.strictEqual(id, '1go10');
        return Promise.resolve({cloneForNew() { return {...source}; }});
      },
    },
  }, 'route');

  let result = await route.model({receiverId: '1go10'});
  let copy = result.get('receiver');

  assert.notOk(Object.prototype.hasOwnProperty.call(copy, 'url'),
    'the old server-issued URL must not be sent as a new capability');
  assert.notOk(Object.prototype.hasOwnProperty.call(copy, 'state'),
    'the old lifecycle state must not be copied');
  assert.strictEqual(copy.scaleHostConfig, source.scaleHostConfig,
    'the chosen config remains available for the new form');
  assert.strictEqual(source.url, 'existing-capability', 'the source is untouched');
  destroyOwned(route);
});

test('a receiver driver without a form is rejected before a clone can be saved', async function(assert) {
  let route = createOwned(NewReceiverRoute, {
    intl: {t(key) { return key; }},
    webhookStore: {
      find() {
        return Promise.resolve({cloneForNew() {
          return {type: 'receiver', driver: 'forwardPost',
            forwardPostConfig: {url: 'https://example.invalid'}};
        }});
      },
    },
  }, 'route');

  try {
    await route.model({receiverId: '1go11'});
    assert.ok(false, 'unsupported source must not open a saveable form');
  } catch (error) {
    assert.strictEqual(error.status, 422);
    assert.strictEqual(error.code, 'UnsupportedReceiverDriver');
    assert.strictEqual(error.messageKey, 'newReceiver.unsupportedDriver');
  }
  destroyOwned(route);
});
