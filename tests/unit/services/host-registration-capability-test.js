import EmberObject from '@ember/object';
import { A } from '@ember/array';
import ApiStore from 'ember-api-store/services/store';
import ProjectsService from 'ui/services/projects';
import HostsNewRoute from 'ui/hosts/new/route';
import HostsNewController from 'ui/hosts/new/controller';
import C from 'ui/utils/constants';
import { module, test } from 'qunit';

module('Unit | Service | native host onboarding capability');

function fixture(registration, machine) {
  const schemas = [
    {id: 'host', type: 'schema', collectionMethods: ['GET'], resourceMethods: ['GET', 'PUT', 'DELETE'], links: {collection: '/v2-beta/projects/1a5/hosts'}},
    {id: 'registrationToken', type: 'schema', collectionMethods: registration ? ['GET', 'POST'] : ['GET'], links: {collection: '/v2-beta/projects/1a5/registrationtokens'}},
    {id: 'machine', type: 'schema', collectionMethods: machine ? ['GET', 'POST'] : ['GET'], links: {collection: '/v2-beta/projects/1a5/machines'}},
  ];
  const store = {
    getById(type, id) { return type === 'schema' ? schemas.find(schema => schema.id.toLowerCase() === id) : null; },
    canCreate: ApiStore.prototype.canCreate,
  };
  return ProjectsService.create({current: EmberObject.create({id: '1a5', isWindows: false}), schemaProjectId: '1a5', schemaLoadGeneration: 7,
    access: EmberObject.create({enabled: true, admin: true}), store});
}

function routeFor(projects, options = {}) {
  const transitions = [];
  const settings = EmberObject.create({[C.SETTING.SHOW_CUSTOM_HOST]: true, [C.SETTING.API_HOST]: 'fixture.invalid', load() { return Promise.resolve(); }});
  const route = HostsNewRoute.create({projects, settings, access: EmberObject.create({admin: false}), machineDrivers: A([]),
    intl: {t(key) { return key; }}, router: {transitionTo(...args) { transitions.push(args); }},
    userStore: {find() { return Promise.resolve([]); }, findAll() { return Promise.resolve([]); }},
    loadCustomUi() { return Promise.resolve(); }, ...options});
  route._super = () => Promise.resolve();
  return {route, transitions, settings};
}

test('native owner host GET-only does not block registration POST', function(assert) {
  const projects = fixture(true, false);
  assert.false(projects.canCreateResource('host'), 'host resource update/delete is not collection POST');
  assert.true(projects.canAddHost());
  assert.true(projects.canAddHostDriver('custom'));
  assert.false(projects.canAddHostDriver('amazonec2'));
  projects.destroy();
});

test('readonly native schemas grant no onboarding, even for admin identity', function(assert) {
  const projects = fixture(false, false);
  assert.false(projects.canAddHost());
  assert.false(projects.canAddHostDriver('custom'));
  assert.false(projects.canAddHostDriver('amazonec2'));
  projects.destroy();
});

test('stale, loading or absent project schemas grant no onboarding', function(assert) {
  const projects = fixture(true, true);
  projects.set('schemaProjectId', '1a6'); assert.false(projects.canAddHost());
  projects.set('schemaProjectId', null); assert.false(projects.canAddHostDriver('custom'));
  projects.set('schemaProjectId', '1a5'); projects.set('current', null); assert.false(projects.canAddHost());
  projects.destroy();
});

test('machine-only capability hides custom and rejects its direct URL before model loads', async function(assert) {
  const projects = fixture(false, true), {route, settings} = routeFor(projects);
  const controller = HostsNewController.create({projects, settings, driver: 'amazonec2'});
  assert.true(projects.canAddHost());
  assert.false(controller.get('allowCustom'));
  assert.true(controller.get('allowOther'));
  controller.actions.switchDriver.call(controller, 'custom');
  assert.strictEqual(controller.get('driver'), 'amazonec2', 'an unallowed switch never selects custom');
  let failure; try {await route.model({driver: 'custom'});} catch (error) {failure = error;}
  assert.strictEqual(failure.status, 403);
  assert.strictEqual(failure.messageKey, 'hostsPage.permissionDenied', 'the existing translated denial is retained');
  controller.destroy(); route.destroy(); projects.destroy();
});

test('readonly route rejects without requesting machine-driver inventory', async function(assert) {
  const projects = fixture(false, false); let requests = 0;
  const {route} = routeFor(projects, {userStore: {find() { requests++; return Promise.resolve([]); }}});
  let failure; try {await route.beforeModel();} catch (error) {failure = error;}
  assert.strictEqual(failure.status, 403); assert.strictEqual(requests, 0);
  route.destroy(); projects.destroy();
});

test('registration-only route stays custom without loading machine UI', async function(assert) {
  const projects = fixture(true, false); let loads = 0;
  const {route} = routeFor(projects, {loadCustomUi() { loads++; return Promise.resolve(); }});
  await route.beforeModel();
  assert.strictEqual(route.get('machineDrivers').length, 0);
  const model = await route.model({driver: 'custom'});
  assert.strictEqual(model.get('availableDrivers').length, 0);
  assert.strictEqual(loads, 0);
  route.destroy(); projects.destroy();
});

test('machine-only default and stale last-custom select an available machine driver', async function(assert) {
  const projects = fixture(false, true);
  const {route, transitions} = routeFor(projects, {lastDriver: 'custom', machineDrivers: A([EmberObject.create({name: 'zebra'}), EmberObject.create({name: 'amazonec2'})])});
  await route.model({});
  assert.strictEqual(transitions[0][0], 'hosts.new');
  assert.strictEqual(transitions[0][1].queryParams.driver, 'amazonec2');
  route.destroy(); projects.destroy();
});

test('model completion cannot borrow a newer schema generation', async function(assert) {
  const projects = fixture(true, false); let release;
  const pending = new Promise(resolve => {release = resolve;});
  const {route, transitions} = routeFor(projects, {userStore: {find(type, id) { return id === 'host' ? pending : Promise.resolve([]); }, findAll() { return Promise.resolve([]); }}});
  const model = route.model({driver: 'custom'});
  projects.incrementProperty('schemaLoadGeneration'); release([]);
  let failure; try {await model;} catch (error) {failure = error;}
  assert.strictEqual(failure.status, 403); assert.strictEqual(transitions.length, 0);
  route.destroy(); projects.destroy();
});
