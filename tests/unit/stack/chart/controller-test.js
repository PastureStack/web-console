import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import StackChartController from 'ui/stack/chart/controller';

module('Unit | Controller | stack/chart');

// Replace this with your real tests.
test('it exists', function(assert) {
  var controller = StackChartController.create();
  assert.ok(controller);
  run(() => controller.destroy());
});

test('it toggles additional service info', function(assert) {
  var service = { id: '1s1' };
  var controller = StackChartController.create();

  controller.send('openInfo', service);
  assert.strictEqual(controller.get('selectedService'), service);
  assert.strictEqual(controller.get('showAddtlInfo'), true);

  controller.send('dismiss');
  assert.strictEqual(controller.get('showAddtlInfo'), false);
  run(() => controller.destroy());
});
