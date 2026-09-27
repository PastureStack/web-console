import { module, test } from 'qunit';
import ContainersNewRoute from 'ui/containers/new/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | containers/new');

test('direct add-container URL rejects without loading resource dependencies', async function(assert) {
  let requests = 0;
  let route = createOwned(ContainersNewRoute, {
    projects: {
      canCreateResource(type) {
        assert.strictEqual(type, 'container');
        return false;
      },
    },
    intl: {
      t(key) {
        assert.ok(['containersPage.index.linkTo', 'containersPage.permissionDenied'].includes(key));
        return key === 'containersPage.index.linkTo' ? 'Add Container' :
          'You do not have permission to add containers in this environment.';
      },
    },
    store: {findAll() { requests++; throw new Error('must not load resources'); }},
  }, 'route');

  try {
    await route.beforeModel();
    assert.ok(false, 'readonly users must not enter the form');
  } catch (error) {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'Forbidden');
    assert.strictEqual(error.title, 'Add Container');
    assert.strictEqual(error.message, 'You do not have permission to add containers in this environment.');
  }
  assert.strictEqual(requests, 0, 'no host/volume/service data was loaded');
  destroyOwned(route);
});

test('container creator may enter the form', async function(assert) {
  let route = createOwned(ContainersNewRoute, {
    projects: {
      canCreateResource(type) {
        assert.strictEqual(type, 'container');
        return true;
      },
    },
  }, 'route');

  await route.beforeModel();
  assert.ok(true, 'authorized route continues');
  destroyOwned(route);
});
