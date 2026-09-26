import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import Host from 'ui/models/host';

module('Unit | Model | host');

test('clone is offered only while the current project can create hosts', function(assert) {
  let project = EmberObject.create({id: '1a-owner'});
  let projects = EmberObject.create({
    current: project,
    schemaProjectId: '1a-owner',
    canCreateResource(type) {
      assert.strictEqual(type, 'host');
      return this.get('schemaProjectId') === project.get('id') && canCreate;
    },
  });
  let canCreate = true;
  let host = Host.create({
    driver: 'custom',
    actionLinks: {},
    links: {},
    projects,
  });
  let cloneAction = () => host.get('availableActions').findBy('action', 'clone');

  assert.true(cloneAction().enabled, 'an owner sees Clone');
  projects.set('schemaProjectId', null);
  canCreate = false;
  assert.false(cloneAction().enabled, 'Clone disappears while permissions reload');
  projects.set('schemaProjectId', '1a-owner');
  assert.false(cloneAction().enabled, 'a read-only schema does not offer Clone');
  host.destroy();
});
