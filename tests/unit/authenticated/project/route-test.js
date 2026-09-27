import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import AuthenticatedProjectRoute from 'ui/authenticated/project/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | authenticated/project');

function projectRoute(project) {
  return createOwned(AuthenticatedProjectRoute, {
    projects: {current: project},
    intl: {
      t(key) {
        return key === 'viewEditProject.error.projectUnavailable' ?
          'This environment does not exist or you do not have permission to view it.' : key;
      },
    },
    router: {
      replaceWith() { throw new Error('unavailable project must show an error'); },
    },
  }, 'route');
}

function expectUnavailable(assert, route, requestedId) {
  let error;
  try {
    route.model({project_id: requestedId});
  } catch (caught) {
    error = caught;
  }
  assert.deepEqual(error, {
    status: 404,
    message: 'This environment does not exist or you do not have permission to view it.',
    messageKey: 'viewEditProject.error.projectUnavailable',
  }, 'missing and denied project IDs have the same localized error without an ID');
}

test('a direct URL with no selected project shows a generic localized 404', function(assert) {
  let route = projectRoute(null);
  expectUnavailable(assert, route, '1a-private');
  destroyOwned(route);
});

test('a direct URL for another project shows the same generic localized 404', function(assert) {
  let route = projectRoute(EmberObject.create({id: '1a-allowed'}));
  expectUnavailable(assert, route, '1a-private');
  destroyOwned(route);
});

test('a direct URL for the selected project still returns its model', function(assert) {
  let project = EmberObject.create({id: '1a-allowed'});
  let route = projectRoute(project);
  assert.strictEqual(route.model({project_id: '1a-allowed'}).get('project'), project);
  destroyOwned(route);
});

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
