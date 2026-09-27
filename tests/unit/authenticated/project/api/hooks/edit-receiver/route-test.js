import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import EditReceiverRoute from 'ui/authenticated/project/api/hooks/edit-receiver/route';
import { createOwned, destroyOwned } from '../../../../../../helpers/owned-subject';

module('Unit | Route | authenticated/project/api/hooks/edit-receiver');

test('direct Edit Receiver URL requires receiver PUT before loading its record', async function(assert) {
  let methods = A(['GET', 'DELETE']);
  let reads = 0;
  let route = createOwned(EditReceiverRoute, {
    webhookStore: {
      getById(type, id) {
        assert.deepEqual([type, id], ['schema', 'receiver']);
        return EmberObject.create({resourceMethods: methods});
      },
      find() { reads++; throw new Error('must not load a receiver without PUT'); },
    },
    intl: {
      t(key) {
        return key === 'newReceiver.title.edit' ? 'Edit Receiver' :
          'Editing receiver hooks is not available in this environment.';
      },
    },
  }, 'route');

  try {
    await route.beforeModel();
    assert.ok(false, 'GET and DELETE do not authorize a nonfunctional edit form');
  } catch (error) {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'Forbidden');
    assert.strictEqual(error.title, 'Edit Receiver');
    assert.strictEqual(error.titleKey, 'newReceiver.title.edit');
    assert.strictEqual(error.message, 'Editing receiver hooks is not available in this environment.');
    assert.strictEqual(error.messageKey, 'hookPage.receiver.editPermissionDenied');
  }
  assert.strictEqual(reads, 0, 'the receiver was not fetched');

  methods.pushObject('PUT');
  await route.beforeModel();
  assert.ok(true, 'a future schema that advertises PUT may enter the form');
  destroyOwned(route);
});
