import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import ProjectsRoute from 'ui/settings/projects/route';
import ProjectsService from 'ui/services/projects';

module('Unit | Route | settings projects');

test('uses the refreshed collection after membership revocation', async function(assert) {
  let revoked = EmberObject.create({id: '1a-revoked'});
  let allowed = EmberObject.create({id: '1a-allowed'});
  let fresh = A([allowed]);
  let templates = A([]);
  let refreshes = 0;
  let projects = EmberObject.create({
    all: A([revoked, allowed]),
    getAll() {
      refreshes++;
      return resolve(fresh);
    },
  });
  let route = ProjectsRoute.create({
    projects,
    userStore: {
      find(type, id, options) {
        assert.strictEqual(type, 'projecttemplate', 'the route only loads templates directly');
        assert.deepEqual(options, {url: 'projectTemplates', forceReload: true, removeMissing: true});
        return resolve(templates);
      },
      all(type) {
        return type === 'project' ? A([revoked, allowed]) : templates;
      },
    },
  });

  let model = await route.model();

  assert.strictEqual(refreshes, 1, 'entering the list requests a fresh collection');
  assert.strictEqual(model.projects, fresh, 'the list uses the fresh collection, not cached projects');
  assert.deepEqual(model.projects.mapBy('id'), [allowed.id], 'the revoked project is absent');
  assert.strictEqual(model.projectTemplates, templates);
  run(() => route.destroy());
});

test('entering environment management and returning preserves the active schema', async function(assert) {
  let current = EmberObject.create({id: '1a-current', state: 'active'});
  let store = EmberObject.create({
    baseUrl: '/v2-beta/projects/1a-current',
    canCreate(type) {
      assert.strictEqual(type, 'host');
      return true;
    },
  });
  let projects = ProjectsService.create({
    current,
    all: A([current]),
    schemaProjectId: current.id,
    schemaLoadGeneration: 4,
    store,
  });
  let requests = 0;
  projects.getAll = () => {
    requests++;
    return resolve(A([current]));
  };
  let route = ProjectsRoute.create({
    projects,
    userStore: {
      find() { return resolve(A([])); },
      all() { return A([]); },
    },
  });

  assert.true(projects.canCreateResource('host'), 'host creation is available before entering management');
  await route.model();

  assert.strictEqual(requests, 1, 'management refreshes the list once');
  assert.strictEqual(projects.get('current'), current, 'the selected environment survives the visit');
  assert.strictEqual(projects.get('schemaProjectId'), current.id, 'returning to the environment retains its schema');
  assert.strictEqual(projects.get('schemaLoadGeneration'), 4, 'the schema generation is not invalidated');
  assert.strictEqual(store.get('baseUrl'), '/v2-beta/projects/1a-current', 'the active API scope is unchanged');
  assert.true(projects.canCreateResource('host'), 'host creation remains available on return');

  run(() => route.destroy());
  run(() => projects.destroy());
});
