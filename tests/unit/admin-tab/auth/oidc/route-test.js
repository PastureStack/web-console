import Ember from 'ember';
import Resource from 'ember-api-store/models/resource';
import { module, test } from 'qunit';

import OidcController from 'ui/admin-tab/auth/oidc/controller';
import OidcRoute from 'ui/admin-tab/auth/oidc/route';
import { createOwned, destroyOwned } from '../../../../helpers/owned-subject';

function record(store, properties) {
  return Resource.create(Object.assign({ store }, properties));
}

module('Unit | Route | admin tab | auth | oidc');

test('it loads and clones the inactive OIDC configuration for local recovery', function(assert) {
  let store = {
    createRecord(properties, options) {
      return record(store, Object.assign({}, properties, {
        type: (options && options.type) || properties.type,
      }));
    },
  };
  let config = record(store, {
    allowedIdentities: [],
    oidcConfig: {},
    provider: 'localAuthConfig',
    type: 'config',
  });
  let localConfig = record(store, {
    enabled: true,
    type: 'localauthconfig',
  });
  let accounts = Ember.A([
    record(store, { id: '1a1', kind: 'admin', state: 'active', type: 'account' }),
  ]);
  let access = Ember.Object.create({ enabled: true, provider: 'localauthconfig' });
  let session = Ember.Object.create({ accountId: '1a1' });
  let route = createOwned(OidcRoute, {
    access,
    authStore: {
      createRecord: store.createRecord,
      find() {
        return Ember.RSVP.resolve(config);
      },
      getById() {
        return Ember.Object.create({
          resourceFields: {
            displayName: { default: 'OpenID Connect' },
            usePkce: { default: true },
          },
        });
      },
    },
    session,
    userStore: {
      find(type) {
        if (type === 'localauthconfig') {
          return Ember.RSVP.resolve(Ember.A([localConfig]));
        }

        return Ember.RSVP.resolve(accounts);
      },
    },
  }, 'route');
  let controller = createOwned(OidcController, {
    access,
    intl: Ember.Object.create({
      t(key) {
        return key;
      },
    }),
    oidc: Ember.Object.create(),
    session,
    settings: Ember.Object.create({
      appName: 'PastureStack',
      get() {
        return null;
      },
    }),
    userStore: Ember.Object.create(),
  }, 'controller');

  return route.model().then((model) => {
    route.setupController(controller, model);

    assert.strictEqual(controller.get('model'), config, 'uses the authentication config as the route model');
    assert.strictEqual(controller.get('accounts'), accounts, 'retains the selectable account collection');
    assert.notStrictEqual(controller.get('recoveryModel'), config, 'takes an isolated provider recovery snapshot');
    assert.notStrictEqual(controller.get('recoveryLocalModel'), localConfig, 'takes an isolated local recovery snapshot');
    assert.equal(controller.get('config.displayName'), 'OpenID Connect', 'applies schema defaults');
    assert.true(controller.get('config.usePkce'), 'preserves the secure PKCE default');
  }).finally(() => {
    destroyOwned(controller);
    destroyOwned(route);
    config.destroy();
    localConfig.destroy();
    accounts.forEach((account) => account.destroy());
  });
});
