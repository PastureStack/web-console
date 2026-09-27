import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import ContainersController from 'ui/containers/index/controller';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Controller | containers/index');

test('add-container visibility follows the current project schema', function(assert) {
  let project = EmberObject.create({id: '1a-owner'});
  let allowed = true;
  let projects = EmberObject.create({
    current: project,
    schemaProjectId: null,
    canCreateResource(type) {
      assert.strictEqual(type, 'container');
      return this.get('schemaProjectId') === this.get('current.id') && allowed;
    },
  });
  let controller = createOwned(ContainersController, {projects}, 'controller');

  assert.false(controller.get('canCreateContainer'), 'no action while schema is loading');
  projects.set('schemaProjectId', '1a-owner');
  assert.true(controller.get('canCreateContainer'), 'POST capability shows the action');
  allowed = false;
  projects.set('schemaProjectId', null);
  projects.set('schemaProjectId', '1a-owner');
  assert.false(controller.get('canCreateContainer'), 'readonly schema hides the action');
  project.set('id', '1a-other');
  assert.false(controller.get('canCreateContainer'), 'project switch cannot reuse stale capability');
  destroyOwned(controller);
});
