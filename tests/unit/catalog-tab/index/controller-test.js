import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import CatalogController from 'ui/catalog-tab/index/controller';

module('Unit | Controller | catalog tab | index');

test('catalog write controls follow current environment capabilities', function(assert) {
  assert.expect(8);
  let modalCalls = 0;
  let createAllowed = false;
  let projects = EmberObject.create({
    current: EmberObject.create({id: '1a1', actionLinks: {}}),
  });
  let controller = CatalogController.create({
    projects,
    catalog: EmberObject.create({catalogs: []}),
    modalService: EmberObject.create({
      toggleModal() {
        modalCalls++;
      },
    }),
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'stack', 'the launch capability is derived from the stack schema');
        return createAllowed;
      },
    }),
  });

  assert.notOk(controller.get('canManageCatalog'), 'a read-only project cannot manage catalogs');
  controller.send('addEnvCatalog');
  assert.strictEqual(modalCalls, 0, 'the management modal is not opened');
  assert.notOk(controller.get('canCreateStack'), 'POST absence hides catalog launch actions');

  projects.set('current.actionLinks', {update: '/v2-beta/projects/1a1'});
  createAllowed = true;
  projects.set('current.id', '1a2');

  assert.ok(controller.get('canManageCatalog'), 'project update capability enables catalog management');
  assert.ok(controller.get('canCreateStack'), 'a project switch re-evaluates the effective schema');
  controller.send('addEnvCatalog');
  assert.strictEqual(modalCalls, 1, 'an authorized user can open catalog management');
  run(() => controller.destroy());
});
