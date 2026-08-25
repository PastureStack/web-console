import { run } from '@ember/runloop';
import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import StorageController from 'ui/host/storage/controller';
import { destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Controller | host | storage');

function removableVolume(id) {
  return EmberObject.create({
    id,
    state: 'detached',
    removed: false,
    instanceId: null,
    mounts: A(),
    actionLinks: {remove: `/v1/volumes/${id}?action=remove`},
  });
}

test('successful removals immediately refresh rows and selection', function(assert) {
  assert.expect(9);

  let first = removableVolume('1v1');
  let second = removableVolume('1v2');
  let model = A([first, second]);
  let modalOptions;
  let controller = StorageController.create({
    modalService: EmberObject.create({
      toggleModal(name, options) {
        assert.equal(name, 'confirm-remove-selected-volumes', 'opens the batch confirmation');
        modalOptions = options;
      },
    }),
    prefs: EmberObject.create(),
  });

  run(() => {
    controller.setProperties({
      model,
      storageFilter: 'detached',
      selectedVolumes: A([first, second]),
    });
  });

  assert.equal(controller.get('filteredVolumes.length'), 2, 'starts with both detached rows');
  assert.equal(controller.get('selectedVolumeCount'), '2', 'starts with both rows selected');

  controller.send('promptRemoveSelected');
  assert.ok(modalOptions, 'provides modal options');

  modalOptions.onRemoved(first);

  assert.deepEqual(model.mapBy('id'), ['1v2'], 'removes a successful row immediately');
  assert.deepEqual(controller.get('filteredVolumes').mapBy('id'), ['1v2'], 'recomputes the visible rows');
  assert.equal(controller.get('selectedVolumeCount'), '1', 'updates the selected count');
  assert.equal(controller.get('storageTableRevision'), 1, 'advances the table revision once');

  modalOptions.onComplete([first]);
  assert.equal(controller.get('storageTableRevision'), 1, 'completion is idempotent after live removal');

  destroyOwned(controller);
});

test('All page size is kept in writable controller state', function(assert) {
  let controller = StorageController.create({
    prefs: EmberObject.create({storageTablePerPage: 25}),
    modalService: EmberObject.create(),
  });

  assert.equal(controller.get('storageTablePerPage'), 25, 'starts from the saved preference');

  controller.send('storagePageSizeChanged', '0');
  assert.equal(controller.get('storageTablePerPage'), 0, 'accepts the semantic All value without mutating a computed input');

  controller.send('storagePageSizeChanged', '999');
  assert.equal(controller.get('storageTablePerPage'), 0, 'ignores unsupported page sizes');

  destroyOwned(controller);
});
