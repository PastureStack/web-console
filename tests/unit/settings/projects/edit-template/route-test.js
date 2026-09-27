import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import EditTemplateRoute from 'ui/settings/projects/edit-template/route';

module('Unit | Route | settings projects edit-template');

function fixture(canEdit, lookupError) {
  let catalogReads = 0;
  let clones = 0;
  let original = EmberObject.create({
    canEdit,
    clone() {
      clones++;
      return EmberObject.create({id: '1pt-test-clone'});
    },
  });
  let route = EditTemplateRoute.create({
    userStore: {
      find(type, id) {
        if ( type !== 'projecttemplate' || id !== '1pt-test' ) {
          throw new Error('unexpected template lookup');
        }
        return lookupError ? reject(lookupError) : resolve(original);
      },
    },
    catalog: {
      fetchTemplates(options) {
        catalogReads++;
        if ( options.templateBase !== 'infra' || options.category !== 'all' ) {
          throw new Error('unexpected catalog lookup');
        }
        return resolve(['catalog-template']);
      },
    },
  });

  return {route, original, catalogReads: () => catalogReads, clones: () => clones};
}

test('a direct URL to another account\'s public template is denied before catalog or clone', async function(assert) {
  let data = fixture(false);

  await data.route.model({template_id: '1pt-test'}).then(
    () => assert.ok(false, 'the edit page must not open'),
    (error) => assert.strictEqual(error.status, 403)
  );
  assert.strictEqual(data.catalogReads(), 0);
  assert.strictEqual(data.clones(), 0);
  run(() => data.route.destroy());
});

test('an owned private template opens its editable clone', async function(assert) {
  let data = fixture(true);
  let model = await data.route.model({template_id: '1pt-test'});

  assert.strictEqual(model.originalProjectTemplate, data.original);
  assert.notStrictEqual(model.projectTemplate, data.original);
  assert.deepEqual(model.catalogInfo, ['catalog-template']);
  assert.strictEqual(data.catalogReads(), 1);
  assert.strictEqual(data.clones(), 1);
  run(() => data.route.destroy());
});

test('an administrator may open a public template edit URL', async function(assert) {
  let data = fixture(true);
  let model = await data.route.model({template_id: '1pt-test'});

  assert.strictEqual(model.originalProjectTemplate, data.original);
  assert.strictEqual(data.catalogReads(), 1);
  assert.strictEqual(data.clones(), 1);
  run(() => data.route.destroy());
});

test('another account\'s private template stays invisible through the API 404', async function(assert) {
  let notFound = {status: 404, code: 'NotFound'};
  let data = fixture(false, notFound);

  await data.route.model({template_id: '1pt-test'}).then(
    () => assert.ok(false, 'the private template must not open'),
    (error) => assert.strictEqual(error, notFound, 'the API denial is preserved')
  );
  assert.strictEqual(data.catalogReads(), 0);
  assert.strictEqual(data.clones(), 0);
  run(() => data.route.destroy());
});

test('a template with no owner fails closed on its direct edit URL', async function(assert) {
  let data = fixture(undefined);

  await data.route.model({template_id: '1pt-test'}).then(
    () => assert.ok(false, 'unknown ownership must not open the form'),
    (error) => assert.strictEqual(error.status, 403)
  );
  assert.strictEqual(data.catalogReads(), 0);
  assert.strictEqual(data.clones(), 0);
  run(() => data.route.destroy());
});
