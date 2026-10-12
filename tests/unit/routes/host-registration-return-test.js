import EmberObject from '@ember/object';
import { setOwner } from '@ember/application';
import { module, test } from 'qunit';
import HostsNewRoute from 'ui/hosts/new/route';

module('Unit | Route | host registration return history');

function fixture(name = 'hosts.index') {
  const project = {name: 'authenticated.project', paramNames: ['project_id'], params: {project_id: '1a5'}};
  const application = EmberObject.create({previousRoute: name, previousParams: ['1a5']});
  const transitions = [], sends = [];
  const router = EmberObject.create({currentRoute: name ? {name, parent: project} : null,
    transitionTo(...args) { transitions.push(args); return Promise.resolve(); }});
  const route = HostsNewRoute.create({router, projects: EmberObject.create({current: EmberObject.create({id: '1a5', isWindows: false}),
    schemaLoadGeneration: 7, canAddHost() { return true; }, canCreateResource() { return false; },
    canAddHostDriver(driver) { return driver === 'custom'; }}), access: EmberObject.create({admin: false}),
    userStore: {find() { return Promise.resolve([]); }, findAll() { return Promise.resolve([]); }},
    settings: EmberObject.create({}), send(...args) { sends.push(args); }});
  setOwner(route, {lookup(key) { return key === 'route:application' ? application : undefined; }});
  return {route, router, application, transitions, sends, project};
}

test('initial Custom redirect keeps the settled external return route', async function(assert) {
  const {route, router, application, transitions, sends, project} = fixture();
  await route.beforeModel();
  await route.model({});
  assert.strictEqual(transitions[0][0], 'hosts.new');
  assert.strictEqual(transitions[0][1].queryParams.driver, 'custom');
  router.set('currentRoute', {name: 'hosts.new.index', parent: project});
  application.set('previousRoute', 'hosts.new.index');
  application.set('previousParams', ['1a5']);
  await route.beforeModel();
  await route.model({driver: 'custom'});
  assert.strictEqual(route.get('previousOpts').name, 'hosts.index');
  assert.deepEqual(route.get('previousOpts').params, ['1a5']);
  route.actions.goBack.call(route);
  assert.strictEqual(application.get('previousRoute'), 'hosts.index');
  assert.deepEqual(sends, [['goToPrevious', 'hosts']]);
  route.destroy();
});

test('API-host saved refresh and driver reload cannot replace an external return target', async function(assert) {
  const {route, router, application, sends, project} = fixture('stacks.index');
  await route.beforeModel();
  const saved = route.get('previousOpts');
  router.set('currentRoute', {name: 'hosts.new.index', parent: project});
  application.set('previousRoute', 'hosts.new.index');
  let refreshed;
  route.refresh = () => { refreshed = route.beforeModel().then(() => route.model({driver: 'custom'})); return refreshed; };
  route.actions.savedHost.call(route);
  await refreshed;
  assert.strictEqual(route.get('previousOpts'), saved);
  assert.strictEqual(saved.name, 'stacks.index');
  router.set('currentRoute', {name: 'hosts.new', parent: project});
  await route.beforeModel();
  assert.strictEqual(route.get('previousOpts'), saved);
  route.actions.goBack.call(route);
  assert.strictEqual(application.get('previousRoute'), 'stacks.index');
  assert.deepEqual(application.get('previousParams'), ['1a5']);
  assert.deepEqual(sends, [['goToPrevious', 'hosts']]);
  route.destroy();
});

test('direct URL missing/self targets fall back to Hosts; waiting remains unchanged', function(assert) {
  const {route, transitions, sends} = fixture(null);
  for (const opts of [null, {name: 'hosts.new', params: ['1a5']}, {name: 'hosts.new.index', params: ['1a5']}]) {
    route.set('previousOpts', opts);
    route.actions.goBack.call(route);
    assert.strictEqual(transitions[transitions.length - 1][0], 'hosts');
  }
  assert.strictEqual(sends.length, 0, 'self targets never dispatch goToPrevious');
  route.set('backTo', 'waiting');
  route.actions.goBack.call(route);
  assert.strictEqual(transitions[transitions.length - 1][0], 'authenticated.project.waiting');
  route.destroy();
});
