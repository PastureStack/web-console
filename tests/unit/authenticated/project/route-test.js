import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import AuthenticatedProjectRoute from 'ui/authenticated/project/route';

module('Unit | Route | authenticated/project');

test('a project initialization 401 dispatches through its transition', function(assert) {
  assert.expect(5);
  let transition = {
    authGeneration: 'generation-project',
    send(action, sentTransition, timedOut, error, generation) {
      assert.strictEqual(action, 'sessionInvalid', 'the passive session action is used');
      assert.strictEqual(sentTransition, transition, 'the failed transition is retained');
      assert.strictEqual(timedOut, true, 'the expiry explanation is retained');
      assert.strictEqual(generation, 'generation-project', 'the request generation is retained');
    },
  };
  let route = AuthenticatedProjectRoute.create();
  route.send = function() {
    assert.ok(false, 'the route hierarchy is not ready during the transition');
  };

  let result = route.loadingError({status: 401}, transition, 'unhandled');
  assert.strictEqual(result, undefined, 'the authentication failure is handled');
  run(() => route.destroy());
});
