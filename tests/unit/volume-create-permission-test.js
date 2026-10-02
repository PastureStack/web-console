import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { module, test } from 'qunit';
import StoragePoolSection from 'ui/components/storagepool-section/component';
import VolumeRoute from 'ui/storagepools/new-volume/route';
import ProjectsService from 'ui/services/projects';
import RequireCreatePermission from 'ui/mixins/require-create-permission';
import { createOwned, destroyOwned } from '../helpers/owned-subject';

module('Unit | Volume create permissions');

function projectContext(schema) {
  return ProjectsService.create({
    current: EmberObject.create({id: 'project-one'}),
    schemaProjectId: 'project-one',
    schemaLoadGeneration: 0,
    store: {
      canCreate(type) {
        return type === 'volume' && schema.collectionMethods.includes('POST');
      },
    },
  });
}

test('Volume CTA tracks schema generation and revoked POST', function(assert) {
  let schema = {collectionMethods: ['GET', 'POST']};
  let projects = projectContext(schema);
  let section = createOwned(StoragePoolSection, {projects}, 'component');
  assert.true(section.get('canCreateVolume'), 'current POST allows the Add predicate');
  schema.collectionMethods = ['GET'];
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(section.get('canCreateVolume'), 'revocation invalidates the cached predicate');
  schema.collectionMethods = ['GET', 'POST'];
  projects.incrementProperty('schemaLoadGeneration');
  assert.true(section.get('canCreateVolume'), 'current fresh POST restores the predicate');
  destroyOwned(section);
  destroyOwned(projects);
});

test('Volume CTA and shared route reject stale, missing and switched projects', async function(assert) {
  let projects = projectContext({collectionMethods: ['GET', 'POST']});
  let section = createOwned(StoragePoolSection, {projects}, 'component');
  let notices = [];
  let route = createOwned(VolumeRoute, {
    projects,
    intl: {t(translationKey) { return translationKey; }},
    growl: {error(title, message) { notices.push([title, message]); }},
    router: {replaceWith(target) { assert.strictEqual(target, 'stacks'); return 'denied'; }},
  }, 'route');
  for (let [current, schemaProjectId] of [[null, 'project-one'], ['project-one', null], ['project-two', 'project-one']]) {
    projects.set('current', current ? EmberObject.create({id: current}) : null);
    projects.set('schemaProjectId', schemaProjectId);
    assert.false(section.get('canCreateVolume'), 'no stale CTA capability survives');
    assert.strictEqual(await route.beforeModel({}), 'denied', 'direct route rejects the same stale schema');
  }
  assert.deepEqual(notices, Array(3).fill(['routePermission.title', 'routePermission.denied']));
  destroyOwned(route);
  destroyOwned(section);
  destroyOwned(projects);
});

test('Volume direct route rejects before createRecord but allows a fresh creator form', async function(assert) {
  let schema = {collectionMethods: ['GET']};
  let projects = projectContext(schema);
  let created = [];
  let notices = [];
  let route = createOwned(VolumeRoute, {
    projects,
    intl: {t(translationKey) { return translationKey; }},
    growl: {error(title, message) { notices.push([title, message]); }},
    router: {replaceWith(target) { assert.strictEqual(target, 'stacks'); return 'redirected'; }},
    store: {createRecord(data) { created.push(data); return EmberObject.create(data); }},
  }, 'route');
  assert.strictEqual(route.get('requiredCreateType'), 'volume');
  assert.strictEqual(await route.beforeModel({}), 'redirected');
  assert.deepEqual(created, [], 'denied beforeModel never creates the form resource');
  assert.deepEqual(notices, [['routePermission.title', 'routePermission.denied']]);
  schema.collectionMethods = ['GET', 'POST'];
  projects.incrementProperty('schemaLoadGeneration');
  await route.beforeModel({});
  let form = route.model({driverName: 'local'});
  assert.strictEqual(form.get('volume.driver'), 'local');
  assert.deepEqual(created, [{type: 'volume', driver: 'local', name: '', driverOpts: {}}],
    'the unchanged model only builds the declared local form after permission succeeds');
  destroyOwned(route);
  destroyOwned(projects);
});

test('shared upgrade preserves PUT branch and notice while rejecting stale PUT schema', async function(assert) {
  let reads = 0;
  let creates = 0;
  let notices = [];
  let projects = projectContext({collectionMethods: ['GET']});
  projects.canCreateResource = function() { creates++; return false; };
  let schema = EmberObject.create({resourceMethods: ['GET', 'PUT']});
  let route = createOwned(Route.extend(RequireCreatePermission), {
    projects,
    requiredCreateType: 'service', requiredUpdateType: 'service', updateWhenQueryParam: 'upgrade',
    intl: {t(translationKey) { return translationKey; }},
    growl: {error(title, message) { notices.push([title, message]); }},
    router: {replaceWith(target) { assert.strictEqual(target, 'stacks'); return 'denied'; }},
    store: {getById(type, id) { reads++; assert.deepEqual([type, id], ['schema', 'service']); return schema; }},
  }, 'route');
  await route.beforeModel({to: {queryParams: {upgrade: 'true'}}});
  assert.strictEqual(reads, 1);assert.strictEqual(creates, 0);assert.deepEqual(notices, []);
  projects.set('schemaProjectId', 'old-project');
  assert.strictEqual(await route.beforeModel({to: {queryParams: {upgrade: true}}}), 'denied');
  assert.strictEqual(reads, 1, 'stale update schema is not inspected');
  projects.set('schemaProjectId', 'project-one');
  schema.set('resourceMethods', ['GET']);
  assert.strictEqual(await route.beforeModel({to: {queryParams: {upgrade: 'true'}}}), 'denied');
  assert.strictEqual(await route.beforeModel({to: {queryParams: {upgrade: 'false'}}}), 'denied');
  assert.strictEqual(creates, 1, 'upgrade=false still uses the create branch');
  assert.deepEqual(notices, [['routePermission.title', 'routePermission.updateDenied'],
    ['routePermission.title', 'routePermission.updateDenied'], ['routePermission.title', 'routePermission.denied']]);
  destroyOwned(route);
  destroyOwned(projects);
});
