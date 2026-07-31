import { module, test } from 'qunit';

import Ember from 'ember';
import BulkActionHandlerService from 'ui/bulk-action-handler/service';

module('Unit | Service | bulk action handler');

// Replace this with your real tests.
test('it exists', function(assert) {
  let service = BulkActionHandlerService.create();
  assert.ok(service);
  Ember.run(() => service.destroy());
});

test('it sends lifecycle actions to each node', function(assert) {
  let service = BulkActionHandlerService.create();
  let sent = [];
  let nodes = [
    { send(action) { sent.push(`first:${action}`); } },
    { send(action) { sent.push(`second:${action}`); } },
  ];

  service.start(nodes);
  service.stop(nodes);
  service.restart(nodes);
  service.delete(nodes);

  assert.deepEqual(sent, [
    'first:start',
    'second:start',
    'first:stop',
    'second:stop',
    'first:restart',
    'second:restart',
    'first:delete',
    'second:delete',
  ]);
  Ember.run(() => service.destroy());
});
