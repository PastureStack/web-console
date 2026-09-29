import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve, reject } from 'rsvp';
import { module, test } from 'qunit';
import LaunchRoute from 'ui/catalog-tab/launch/route';

module('Unit | Route | catalog launch permissions');

function fixture({canCreate=false, actionLinks={}, findError=null, templateError=null, upgradeError=null}={}) {
  let reads = 0;
  let stack = EmberObject.create({id: '1st-qa', actionLinks});
  let route = LaunchRoute.create({
    intl: {t: (key) => key},
    projects: {current: EmberObject.create({id: 'project-1'}), canCreateResource(type) {
      if ( type !== 'stack' ) {
        throw new Error('unexpected create type');
      }
      return canCreate;
    }},
    store: {
      find(type, id) {
        if ( type !== 'stack' || id !== '1st-qa' ) {
          throw new Error('unexpected stack lookup');
        }
        reads++;
        return findError ? reject(findError) : resolve(stack);
      },
      createRecord() {
        return EmberObject.create({type: 'stack'});
      },
    },
    catalog: {
      fetchTemplate(id, isUpgrade) {
        let error = isUpgrade ? upgradeError : templateError;
        if ( error ) {
          return reject(error);
        }
        return resolve(EmberObject.create({
          defaultName: 'test', templateBase: 'user', versionLinks: {},
          upgradeVersionLinks: {}, version: '1', links: {self: '/version'},
        }));
      },
    },
    modelFor() {
      return EmberObject.create({catalog: [], templateBase: 'user'});
    },
  });

  return {route, stack, reads: () => reads};
}

test('a version-id upgrade uses the exact stack upgrade action, not stack create', async function(assert) {
  let data = fixture({actionLinks: {upgrade: '/upgrade'}});
  let result = await data.route.model({template: 'tpl', stackId: '1st-qa', upgrade: 'version-id'});
  assert.strictEqual(result.get('stack'), data.stack);
  assert.strictEqual(result.get('projectId'), 'project-1');
  assert.strictEqual(data.reads(), 1);
  run(() => data.route.destroy());
});

test('direct template and version denials hide private API details', async function(assert) {
  for (let status of [403, 404]) {
    let create = fixture({canCreate: true, templateError: {status, message: 'private template ID'}});
    await create.route.model({template: 'tpl'}).then(
      () => assert.ok(false, 'denied template must not open'),
      (error) => {
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.messageKey, 'newCatalog.templateUnavailable');
        assert.notOk(JSON.stringify(error).includes('private template ID'));
      }
    );
    run(() => create.route.destroy());

    let upgrade = fixture({
      actionLinks: {upgrade: '/upgrade'},
      upgradeError: {status, message: 'private version ID'},
    });
    await upgrade.route.model({template: 'tpl', stackId: '1st-qa', upgrade: 'version-id'}).then(
      () => assert.ok(false, 'denied version must not open'),
      (error) => {
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.messageKey, 'newCatalog.upgradeUnavailable');
        assert.notOk(JSON.stringify(error).includes('private version ID'));
      }
    );
    run(() => upgrade.route.destroy());
  }
});

test('create-only role cannot open an existing stack upgrade', async function(assert) {
  let data = fixture({canCreate: true});
  await data.route.model({template: 'tpl', stackId: '1st-qa', upgrade: 'version-id'}).then(
    () => assert.ok(false, 'upgrade form must be denied'),
    (error) => assert.strictEqual(error.messageKey, 'newCatalog.upgradeUnavailable')
  );
  assert.strictEqual(data.reads(), 1);
  run(() => data.route.destroy());
});

test('new stack requires create permission before loading the catalog', async function(assert) {
  let denied = fixture();
  assert.throws(() => denied.route.model({template: 'tpl'}),
    (error) => error.messageKey === 'newCatalog.permissionDenied');
  run(() => denied.route.destroy());

  let allowed = fixture({canCreate: true});
  let result = await allowed.route.model({template: 'tpl'});
  assert.strictEqual(result.get('stack.type'), 'stack');
  run(() => allowed.route.destroy());
});

test('direct stack ID 403 and 404 receive the same safe, localized error', async function(assert) {
  for ( let status of [403, 404] ) {
    let data = fixture({findError: {status, message: 'private detail'}});
    await data.route.model({template: 'tpl', stackId: '1st-qa', upgrade: 'version-id'}).then(
      () => assert.ok(false, 'cross-project stack must not open'),
      (error) => {
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.code, 'NotFound');
        assert.strictEqual(error.messageKey, 'resourceLoadError.stackUnavailable');
      }
    );
    run(() => data.route.destroy());
  }
});
