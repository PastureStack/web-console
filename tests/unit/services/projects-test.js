import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { reject } from 'rsvp';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import ProjectsService from 'ui/services/projects';
import C from 'ui/utils/constants';

module('Unit | Service | projects');

test('authenticated administrator requests all environments for project switching', async function(assert) {
  let requests = [];
  let projects = A([EmberObject.create({id: '1a-default'}), EmberObject.create({id: '1a-qa'})]);
  let service = ProjectsService.create({
    access: EmberObject.create({enabled: true, admin: true}),
    userStore: {
      find(type, id, options) {
        requests.push({type, id, options});
        return Promise.resolve(projects);
      },
    },
  });

  assert.strictEqual(await service.getAll(), projects);
  assert.deepEqual(requests, [{
    type: 'project', id: null,
    options: {url: 'projects', forceReload: true, filter: {all: 'true'}},
  }], 'the administrator asks the API for projects without direct membership');
  run(() => service.destroy());
});

test('authenticated non-administrator requests only member environments', async function(assert) {
  let requests = [];
  let service = ProjectsService.create({
    access: EmberObject.create({enabled: true, admin: false}),
    userStore: {
      find(type, id, options) {
        requests.push({type, id, options});
        return Promise.resolve(A([]));
      },
    },
  });

  await service.getAll();
  assert.deepEqual(requests, [{
    type: 'project', id: null,
    options: {url: 'projects', forceReload: true},
  }], 'ordinary users do not request the administrator-only collection');
  run(() => service.destroy());
});

test('create capability follows the current project and its loaded schema', function(assert) {
  let project = EmberObject.create({id: '1a-owner'});
  let allowed = true;
  let service = ProjectsService.create({
    current: project,
    schemaProjectId: null,
    store: {
      canCreate(type) {
        assert.strictEqual(type, 'host');
        return allowed;
      },
    },
  });

  assert.false(service.canCreateResource('host'), 'a stale schema cannot grant create access');
  service.set('schemaProjectId', '1a-owner');
  assert.true(service.canCreateResource('host'), 'matching creator schema grants access');
  allowed = false;
  assert.false(service.canCreateResource('host'), 'same-project read-only schema revokes access');
  project.set('id', '1a-other');
  assert.false(service.canCreateResource('host'), 'project switch never borrows old create access');
  run(() => service.destroy());
});

test('no active environment is a valid empty selection', async function(assert) {
  let tabSession = EmberObject.create({[C.TABSESSION.PROJECT]: 'stale-tab-project'});
  let prefs = EmberObject.create({[C.PREFS.PROJECT_DEFAULT]: 'stale-preference-project'});
  let store = EmberObject.create({baseUrl: '/v2-beta/projects/stale'});
  let service = ProjectsService.create({
    access: EmberObject.create({admin: false}),
    all: A([]),
    app: EmberObject.create({apiEndpoint: '/v2-beta'}),
    prefs,
    store,
    'tab-session': tabSession,
  });

  service._activeProjectFromId = () => reject({status: 404});

  let selected = await service.selectDefault('missing-direct-project');

  assert.strictEqual(selected, null, 'selection resolves to the intentional empty state');
  assert.strictEqual(service.get('current'), null, 'there is no current environment');
  assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), undefined, 'the stale tab selection is cleared');
  assert.strictEqual(store.get('baseUrl'), '/v2-beta', 'the resource store returns to the global API root');
  assert.strictEqual(prefs.get(C.PREFS.PROJECT_DEFAULT), 'stale-preference-project',
    'the preference is not rewritten without a replacement environment');

  run(() => service.destroy());
});

test('refreshAll waits for reselection and clears a revoked current environment', async function(assert) {
  let tabSession = EmberObject.create({[C.TABSESSION.PROJECT]: 'revoked-project'});
  let store = EmberObject.create({baseUrl: '/v2-beta/projects/revoked-project'});
  let service = ProjectsService.create({
    access: EmberObject.create({admin: false}),
    app: EmberObject.create({apiEndpoint: '/v2-beta'}),
    prefs: EmberObject.create(),
    store,
    'tab-session': tabSession,
  });

  service.getAll = () => Promise.resolve(A([]));
  service._activeProjectFromId = () => reject({status: 404});

  let selected = await service.refreshAll();

  assert.strictEqual(selected, null, 'refresh resolves only after the empty selection is committed');
  assert.strictEqual(service.get('current'), null, 'the revoked environment is no longer current');
  assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), undefined, 'the revoked tab selection is cleared');
  assert.strictEqual(store.get('baseUrl'), '/v2-beta', 'project-scoped requests cannot reuse the revoked API root');

  run(() => service.destroy());
});

test('refreshAll rechecks a cached environment after membership is revoked', async function(assert) {
  for (let status of [403, 404]) {
    let revoked = EmberObject.create({id: '1a-revoked', state: 'active'});
    let allowed = EmberObject.create({id: '1a-allowed', state: 'active'});
    let requests = [];
    let tabSession = EmberObject.create({[C.TABSESSION.PROJECT]: revoked.id});
    let prefs = EmberObject.create({[C.PREFS.PROJECT_DEFAULT]: allowed.id});
    let store = EmberObject.create({baseUrl: '/v2-beta/projects/1a-revoked'});
    let service = ProjectsService.create({
      access: EmberObject.create({enabled: true, admin: false}),
      app: EmberObject.create({apiEndpoint: '/v2-beta'}),
      current: revoked,
      prefs,
      store,
      'tab-session': tabSession,
      userStore: {
        find(type, id, options) {
          requests.push({type, id, options});
          if (id === null) {
            return Promise.resolve(A([allowed]));
          }
          if (id === revoked.id) {
            return options.forceReload ? reject({status}) : Promise.resolve(revoked);
          }
          return Promise.resolve(allowed);
        },
      },
    });

    assert.strictEqual(await service.refreshAll(), allowed, `${status}: the allowed default is selected`);
    assert.deepEqual(service.get('all').mapBy('id'), [allowed.id], `${status}: the list follows the fresh response`);
    assert.strictEqual(service.get('current'), allowed, `${status}: the revoked project is no longer current`);
    assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), allowed.id, `${status}: the tab selection is updated`);
    assert.strictEqual(store.get('baseUrl'), '/v2-beta/projects/1a-allowed', `${status}: resource requests use the allowed project`);
    assert.deepEqual(requests.map(({id, options}) => ({id, forceReload: options.forceReload})), [
      {id: null, forceReload: true},
      {id: revoked.id, forceReload: true},
      {id: allowed.id, forceReload: true},
    ], `${status}: each selected ID is rechecked against the API`);

    run(() => service.destroy());
  }
});

test('a permitted direct environment remains selectable even when absent from the collection', async function(assert) {
  let direct = EmberObject.create({id: '1a-direct', state: 'active'});
  let requests = [];
  let tabSession = EmberObject.create();
  let store = EmberObject.create({baseUrl: '/v2-beta'});
  let service = ProjectsService.create({
    access: EmberObject.create({enabled: true, admin: false}),
    all: A([]),
    app: EmberObject.create({apiEndpoint: '/v2-beta'}),
    prefs: EmberObject.create(),
    store,
    'tab-session': tabSession,
    userStore: {
      find(type, id, options) {
        requests.push({type, id, options});
        return Promise.resolve(direct);
      },
    },
  });

  assert.strictEqual(await service.selectDefault(direct.id), direct);
  assert.strictEqual(service.get('current'), direct);
  assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), direct.id);
  assert.strictEqual(store.get('baseUrl'), '/v2-beta/projects/1a-direct');
  assert.deepEqual(requests.map(({id, options}) => ({id, forceReload: options.forceReload})), [
    {id: direct.id, forceReload: true},
  ]);
  run(() => service.destroy());
});

test('authentication and server errors do not select another environment', async function(assert) {
  for (let status of [401, 500]) {
    let failure = {status};
    let requests = [];
    let service = ProjectsService.create({
      access: EmberObject.create({enabled: true, admin: false}),
      all: A([EmberObject.create({id: '1a-fallback', state: 'active'})]),
      prefs: EmberObject.create({[C.PREFS.PROJECT_DEFAULT]: '1a-fallback'}),
      'tab-session': EmberObject.create({[C.TABSESSION.PROJECT]: '1a-fallback'}),
      userStore: {
        find(type, id) {
          requests.push(id);
          return reject(failure);
        },
      },
    });

    let caught;
    try {
      await service.selectDefault('1a-requested');
    } catch (err) {
      caught = err;
    }
    assert.strictEqual(caught, failure, `${status}: the original error reaches the route`);
    assert.deepEqual(requests, ['1a-requested'], `${status}: no fallback project is selected`);
    assert.strictEqual(service.get('current'), null);
    run(() => service.destroy());
  }
});
