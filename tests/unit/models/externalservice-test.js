import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import ExternalService from 'ui/models/externalservice';

module('Unit | Model | externalservice');

test('API hydration can replace the healthy default including with null', function(assert) {
  let service = ExternalService.create({
    healthState: 'unhealthy',
    type: 'externalService',
  });

  assert.equal(service.get('healthState'), 'unhealthy', 'an API state overrides the local default');
  service.set('healthState', null);
  assert.strictEqual(service.get('healthState'), null, 'an API null is preserved without a setter crash');
  service.set('healthState', 'healthy');
  assert.equal(service.get('healthState'), 'healthy', 'subsequent hydration updates remain writable');

  run(() => service.destroy());
});
