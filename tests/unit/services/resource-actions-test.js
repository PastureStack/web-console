import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import ResourceActionsService from 'ui/services/resource-actions';

module('Unit | Service | resource actions');

test('it trims and collapses dividers using native arrays', function(assert) {
  let service = ResourceActionsService.create({
    model: EmberObject.create({
      availableActions: [
        { divider: true },
        { label: 'start' },
        { divider: true },
        { divider: true },
        { label: 'stop' },
        { divider: true },
      ],
    }),
  });

  assert.deepEqual(
    service.get('activeActions').map((item) => item.label || 'divider'),
    ['start', 'divider', 'stop']
  );

  run(() => service.destroy());
});
