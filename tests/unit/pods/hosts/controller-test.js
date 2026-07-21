import { module, test } from 'qunit';

import Ember from 'ember';
import HostsController from 'ui/hosts/controller';

module('Unit | Controller | hosts');

// Replace this with your real tests.
test('it exists', function(assert) {
  var controller = HostsController.create();
  assert.ok(controller);
  Ember.run(() => controller.destroy());
});
