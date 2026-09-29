import { module, test } from 'qunit';
import Container from 'ui/models/container';
import { destroyOwned } from '../../helpers/owned-subject';

module('Unit | Model | container permissions');

test('remove action requires this container ID to expose a remove link', function(assert) {
  let container = Container.create({state: 'running', actionLinks: {}});

  assert.false(container.get('canDelete'), 'readable running container without DELETE capability cannot be removed');
  assert.false(container.get('availableActions').find((action) => action.action === 'promptDelete').enabled,
    'the unavailable remove choice is filtered from the menu');

  container.set('actionLinks', {remove: 'https://example.invalid/remove'});
  assert.true(container.get('canDelete'), 'a running container with its own remove link can be removed');
  assert.true(container.get('availableActions').find((action) => action.action === 'promptDelete').enabled,
    'the permitted remove choice appears in the menu');

  container.set('state', 'removed');
  assert.false(container.get('canDelete'), 'removed containers remain non-removable');
  destroyOwned(container);
});
