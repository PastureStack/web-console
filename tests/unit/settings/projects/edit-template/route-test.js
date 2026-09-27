import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import EditTemplateRoute from 'ui/settings/projects/edit-template/route';

module('Unit | Route | settings projects edit-template');

const unavailableKey = 'resourceLoadError.projectTemplateUnavailable';
const unavailableMessage = 'This environment template does not exist or you do not have permission to edit it.';

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
    intl: EmberObject.create({t(key) {
      if ( key !== unavailableKey ) {
        throw new Error(`unexpected translation ${key}`);
      }
      return unavailableMessage;
    }}),
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
    (error) => assert.deepEqual(error, {status: 404, message: unavailableMessage, messageKey: unavailableKey})
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

test('API 403 and 404 both become the same localized missing-or-denied message', async function(assert) {
  for (let status of [403, 404]) {
    let data = fixture(false, {status, code: status === 403 ? 'Forbidden' : 'NotFound', message: 'Raw API error'});

    await data.route.model({template_id: '1pt-test'}).then(
      () => assert.ok(false, 'the private template must not open'),
      (error) => assert.deepEqual(error, {status: 404, message: unavailableMessage, messageKey: unavailableKey})
    );
    assert.strictEqual(data.catalogReads(), 0);
    assert.strictEqual(data.clones(), 0);
    run(() => data.route.destroy());
  }
});

test('API 401 still reaches the shared session recovery', async function(assert) {
  let expired = {status: 401, message: 'Expired session'};
  let data = fixture(false, expired);

  await data.route.model({template_id: '1pt-test'}).then(
    () => assert.ok(false, 'the expired session must not open the form'),
    (error) => assert.strictEqual(error, expired)
  );
  assert.strictEqual(data.catalogReads(), 0);
  run(() => data.route.destroy());
});

test('a template with no owner fails closed on its direct edit URL', async function(assert) {
  let data = fixture(undefined);

  await data.route.model({template_id: '1pt-test'}).then(
    () => assert.ok(false, 'unknown ownership must not open the form'),
    (error) => assert.deepEqual(error, {status: 404, message: unavailableMessage, messageKey: unavailableKey})
  );
  assert.strictEqual(data.catalogReads(), 0);
  assert.strictEqual(data.clones(), 0);
  run(() => data.route.destroy());
});
