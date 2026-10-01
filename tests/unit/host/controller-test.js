import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import HostController from 'ui/host/controller';
import ProjectsService from 'ui/services/projects';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Controller | host');

function createSubject(assert, schemaProjectId = '1a2540') {
  let project = EmberObject.create({id: '1a2540'});
  let schema = EmberObject.create({collectionMethods: ['GET', 'POST']});
  let projects = createOwned(ProjectsService, {
    current: project,
    schemaProjectId,
    store: {
      canCreate(type) {
        assert.strictEqual(type, 'container', 'checks the container schema, not host permissions');
        return schema.get('collectionMethods').includes('POST');
      },
    },
  }, 'service');
  let controller = createOwned(HostController, {projects}, 'controller');

  return {
    controller,
    project,
    projects,
    schema,
    destroy() {
      destroyOwned(controller);
      destroyOwned(projects);
      destroyOwned(project);
      destroyOwned(schema);
    },
  };
}

test('add-container stays hidden until the current project schema is ready', function(assert) {
  let subject = createSubject(assert, null);

  assert.false(subject.controller.get('canCreateContainer'), 'schema loading cannot expose the action');
  subject.projects.set('schemaProjectId', '1a2540');
  assert.true(subject.controller.get('canCreateContainer'), 'a matching loaded POST schema exposes the action');
  subject.destroy();
});

test('add-container follows the container POST capability', function(assert) {
  let subject = createSubject(assert);

  subject.schema.set('collectionMethods', ['GET']);
  assert.false(subject.controller.get('canCreateContainer'), 'a read-only container schema hides the action');
  subject.schema.set('collectionMethods', ['GET', 'POST']);
  subject.projects.incrementProperty('schemaLoadGeneration');
  assert.true(subject.controller.get('canCreateContainer'), 'a creator schema exposes the action without role-name checks');
  subject.destroy();
});

test('a project switch cannot reuse a stale container capability', function(assert) {
  let subject = createSubject(assert);

  assert.true(subject.controller.get('canCreateContainer'), 'starts with an authorized loaded schema');
  subject.project.set('id', '1a-other');
  assert.false(subject.controller.get('canCreateContainer'), 'the old project schema cannot grant access');
  subject.projects.set('schemaProjectId', '1a-other');
  assert.true(subject.controller.get('canCreateContainer'), 'the new matching schema may grant access');
  subject.destroy();
});

test('same-project schema generations revoke cached container creation', function(assert) {
  let subject = createSubject(assert);

  assert.true(subject.controller.get('canCreateContainer'), 'starts with the current POST capability');
  subject.schema.set('collectionMethods', ['GET']);
  subject.projects.incrementProperty('schemaLoadGeneration');
  assert.false(subject.controller.get('canCreateContainer'), 'a same-project schema reload revokes the cached action');
  subject.schema.set('collectionMethods', ['GET', 'POST']);
  subject.projects.incrementProperty('schemaLoadGeneration');
  assert.true(subject.controller.get('canCreateContainer'), 'a later schema generation can restore the action');
  subject.destroy();
});
