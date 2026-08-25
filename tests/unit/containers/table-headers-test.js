import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import HostContainersController from 'ui/host/containers/controller';
import ServiceContainersController from 'ui/service/containers/controller';

function columnKeys(controller) {
  return controller.get('headers').map((header) => header.columnKey);
}

function destroy(controller) {
  run(() => controller.destroy());
}

module('Unit | Containers | table headers');

test('host containers keep metrics first and separate image from command', function(assert) {
  let controller = HostContainersController.create();
  let headers = controller.get('headers');

  assert.deepEqual(columnKeys(controller), [
    'state',
    'name',
    'cpu',
    'ram',
    'network',
    'storage',
    'image',
    'ip',
    'command',
    'actions',
  ]);
  assert.equal(headers.findBy('columnKey', 'image').translationKey, 'containersPage.table.image');
  assert.equal(headers.findBy('columnKey', 'ip').translationKey, 'containersPage.table.ipAddress');
  assert.ok(headers.findBy('columnKey', 'image').defaultHidden, 'container image is hidden by default');
  assert.ok(headers.findBy('columnKey', 'command').defaultHidden, 'command is hidden by default');
  assert.equal(controller.get('statsColumnPreferenceKey'), 'hostContainerColumnsV2', 'new defaults do not inherit the old visible image preference');

  destroy(controller);
});

test('service containers use the same primary order before host and command', function(assert) {
  let controller = ServiceContainersController.create();
  let headers = controller.get('headers');

  assert.deepEqual(columnKeys(controller), [
    'state',
    'name',
    'cpu',
    'ram',
    'network',
    'storage',
    'image',
    'ip',
    'host',
    'command',
    'actions',
  ]);
  assert.equal(headers.findBy('columnKey', 'image').translationKey, 'containersPage.table.image');
  assert.equal(headers.findBy('columnKey', 'ip').translationKey, 'containersPage.table.ipAddress');
  assert.ok(headers.findBy('columnKey', 'image').defaultHidden, 'container image is hidden by default');
  assert.ok(headers.findBy('columnKey', 'command').defaultHidden, 'command is hidden by default');
  assert.equal(controller.get('statsColumnPreferenceKey'), 'serviceContainerColumnsV2', 'new defaults do not inherit the old visible image preference');

  destroy(controller);
});
