import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import HostsIndexController from 'ui/hosts/index/controller';
import { createOwned, destroyOwned } from '../../../../helpers/owned-subject';

module('Unit | Controller | hosts/index');

test('add-host visibility follows the selected project capability', function(assert) {
  let project = EmberObject.create({id: 'owner-project'});
  let projects = EmberObject.create({
    current: project,
    schemaProjectId: null,
    canCreateResource(type) {
      assert.strictEqual(type, 'host');
      return this.get('schemaProjectId') === project.get('id') && canCreate;
    },
  });
  let canCreate = true;
  let controller = createOwned(HostsIndexController, {
    projects,
  }, 'controller');

  assert.false(controller.get('canAddHost'), 'schema loading must finish before the action appears');
  projects.set('schemaProjectId', 'owner-project');
  assert.true(controller.get('canAddHost'), 'host creators see the action');
  projects.set('schemaProjectId', null);
  canCreate = false;
  assert.false(controller.get('canAddHost'), 'the same project loses the action while its schema reloads');
  projects.set('schemaProjectId', 'owner-project');
  assert.false(controller.get('canAddHost'), 'the reloaded read-only schema keeps the action hidden');
  project.set('id', 'readonly-project');
  assert.false(controller.get('canAddHost'), 'the action disappears after a project switch');
  destroyOwned(controller);
});
