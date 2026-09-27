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
    assert.strictEqual(error.message, 'You do not have permission to add receiver hooks in this environment.');
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
