import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import ProjectsRoute from 'ui/settings/projects/route';

module('Unit | Route | settings projects');

test('uses the refreshed collection after membership revocation', async function(assert) {
  let revoked = EmberObject.create({id: '1a-revoked'});
  let allowed = EmberObject.create({id: '1a-allowed'});
  let fresh = A([allowed]);
  let templates = A([]);
  let refreshes = 0;
  let projects = EmberObject.create({
    all: A([revoked, allowed]),
    refreshAll() {
      refreshes++;
      this.set('all', fresh);
      return resolve(allowed);
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

  assert.strictEqual(refreshes, 1, 'entering the list rechecks the current selection');
  assert.strictEqual(model.projects, fresh, 'the list uses the fresh collection, not cached projects');
  assert.deepEqual(model.projects.mapBy('id'), [allowed.id], 'the revoked project is absent');
  assert.strictEqual(model.projectTemplates, templates);
  run(() => route.destroy());
});
