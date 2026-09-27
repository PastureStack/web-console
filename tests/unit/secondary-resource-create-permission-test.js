import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import SecretsIndexController from 'ui/secrets/index/controller';
import CertificatesIndexController from 'ui/certificates/index/controller';
import RegistriesIndexController from 'ui/registries/index/controller';
import SecretsNewRoute from 'ui/secrets/new/route';
import CertificatesNewRoute from 'ui/certificates/new/route';
import RegistriesNewRoute from 'ui/registries/new/route';
import ProjectsService from 'ui/services/projects';
import { createOwned, destroyOwned } from '../helpers/owned-subject';

const resources = [
  {name: 'secret', Controller: SecretsIndexController, Route: SecretsNewRoute, property: 'canCreateSecret', types: ['secret'], page: 'secretsPage'},
  {name: 'certificate', Controller: CertificatesIndexController, Route: CertificatesNewRoute, property: 'canCreateCertificate', types: ['certificate'], page: 'certificatesPage'},
  {name: 'registry', Controller: RegistriesIndexController, Route: RegistriesNewRoute, property: 'canCreateRegistry', types: ['registry', 'registryCredential'], page: 'registriesPage'},
];

module('Unit | Secondary resource create permissions');

test('Registry list and Add route use lowercase cached schema IDs', async function(assert) {
  let cachedSchemas = {
    registry: {collectionMethods: ['GET', 'POST']},
    registrycredential: {collectionMethods: ['GET', 'POST']},
  };
  let projects = ProjectsService.create({
    current: EmberObject.create({id: 'owner-project'}),
    schemaProjectId: 'owner-project',
    store: {
      canCreate(type) {
        let schema = cachedSchemas[type];
        return Boolean(schema && schema.collectionMethods.includes('POST'));
      },
    },
  });
  let controller = createOwned(RegistriesIndexController, {projects}, 'controller');
  let route = createOwned(RegistriesNewRoute, {
    projects,
    intl: {t(key) { return key; }},
  }, 'route');

  assert.true(controller.get('canCreateRegistry'),
    'Registry Add is visible when both real cached schemas permit POST');
  await route.beforeModel();
  assert.ok(true, 'the direct Add route accepts the same capabilities');
  cachedSchemas.registrycredential.collectionMethods = ['GET'];
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(controller.get('canCreateRegistry'),
    'Registry Add hides when credential POST is revoked');
  try {
    await route.beforeModel();
    assert.ok(false, 'the direct Add route must reject revoked capability');
  } catch (error) {
    assert.strictEqual(error.status, 403);
  }

  destroyOwned(route);
  destroyOwned(controller);
  destroyOwned(projects);
});

resources.forEach(({name, Controller, Route, property, types, page}) => {
  test(`${name} Add visibility tracks the current project schema`, function(assert) {
    let project = EmberObject.create({id: 'owner-project'});
    let capabilities = Object.fromEntries(types.map((type) => [type, true]));
    let projects = EmberObject.create({
      current: project,
      schemaProjectId: null,
      schemaLoadGeneration: 0,
      canCreateResource(type) {
        assert.ok(types.includes(type), `only ${name} capabilities are inspected`);
        return this.get('schemaProjectId') === this.get('current.id') && capabilities[type];
      },
    });
    let controller = createOwned(Controller, {projects}, 'controller');

    assert.false(controller.get(property), 'hidden before the schema loads');
    projects.set('schemaProjectId', 'owner-project');
    assert.true(controller.get(property), 'shown when all required POST capabilities exist');
    capabilities[types[types.length - 1]] = false;
    projects.incrementProperty('schemaLoadGeneration');
    assert.false(controller.get(property), 'hidden when a required POST capability is absent');
    capabilities[types[types.length - 1]] = true;
    projects.incrementProperty('schemaLoadGeneration');
    project.set('id', 'another-project');
    assert.false(controller.get(property), 'a project switch cannot reuse stale permissions');

    destroyOwned(controller);
  });

  test(`${name} direct Add route denies missing POST capability before entering the form`, async function(assert) {
    let checked = [];
    let createRequests = 0;
    let route = createOwned(Route, {
      projects: {
        canCreateResource(type) {
          checked.push(type);
          return type !== types[types.length - 1];
        },
      },
      intl: {t(key) { return `translated:${key}`; }},
      store: {createRecord() { createRequests++; throw new Error('must not create a resource'); }},
    }, 'route');

    try {
      await route.beforeModel();
      assert.ok(false, 'the denied route must reject');
    } catch (error) {
      assert.strictEqual(error.status, 403);
      assert.strictEqual(error.code, 'Forbidden');
      assert.strictEqual(error.titleKey, `${page}.index.linkTo`);
      assert.strictEqual(error.messageKey, `${page}.permissionDenied`);
      assert.strictEqual(error.title, `translated:${page}.index.linkTo`);
      assert.strictEqual(error.message, `translated:${page}.permissionDenied`);
    }
    assert.deepEqual(checked, types, 'all required capabilities are checked');
    assert.strictEqual(createRequests, 0, 'no resource is created');
    destroyOwned(route);
  });

  test(`${name} creator may enter the Add route`, async function(assert) {
    let checked = [];
    let route = createOwned(Route, {
      projects: {
        canCreateResource(type) {
          checked.push(type);
          return true;
        },
      },
    }, 'route');

    await route.beforeModel();
    assert.deepEqual(checked, types);
    destroyOwned(route);
  });
});
