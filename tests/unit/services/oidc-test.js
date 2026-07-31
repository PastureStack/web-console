import { resolve } from 'rsvp';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import OidcService from 'ui/services/oidc';
import C from 'ui/utils/constants';

module('Unit | Service | oidc');

function createService(transaction) {
  let tabSession = EmberObject.create();
  tabSession.set(C.TABSESSION.OIDC_TRANSACTION, transaction);

  return OidcService.create({
    intl: EmberObject.create({
      t(key) {
        return key;
      },
    }),
    'tab-session': tabSession,
  });
}

test('exchanges a single-use state for an opaque authorization payload', function(assert) {
  let service = createService({
    codeVerifier: 'verifier',
    createdAt: Date.now(),
    nonce: 'nonce',
    state: 'expected-state',
  });

  let payload = JSON.parse(service.consumeAuthorization({
    code: 'authorization-code',
    state: 'expected-state',
  }));

  assert.deepEqual(payload, {
    authorizationCode: 'authorization-code',
    codeVerifier: 'verifier',
    nonce: 'nonce',
  });
  assert.strictEqual(service.get('tab-session').get(C.TABSESSION.OIDC_TRANSACTION), undefined, 'transaction is consumed');

  run(() => service.destroy());
});

test('rejects a mismatched state and still consumes the transaction', function(assert) {
  let service = createService({
    createdAt: Date.now(),
    nonce: 'nonce',
    state: 'expected-state',
  });

  assert.throws(() => {
    service.consumeAuthorization({
      code: 'authorization-code',
      state: 'unexpected-state',
    });
  }, /loginOidc\.error\.stateMismatch/);
  assert.strictEqual(service.get('tab-session').get(C.TABSESSION.OIDC_TRANSACTION), undefined, 'failed transaction cannot be replayed');

  run(() => service.destroy());
});

test('prepares a provider without saving the active authentication configuration', function(assert) {
  let service = createService();
  let config = EmberObject.create({provider: 'oidcconfig'});
  let request;

  service.set('authStore', EmberObject.create({
    rawRequest(options) {
      request = options;
      return resolve({
        body: {
          provider: 'oidc',
          redirectUrl: 'https://identity.example/authorize',
        },
      });
    },
  }));

  return service.prepare(config).then((result) => {
    assert.strictEqual(request.url, 'redirectUrl');
    assert.strictEqual(request.method, 'POST');
    assert.strictEqual(request.data, config, 'the unsaved candidate is validated in place');
    assert.strictEqual(result.provider, 'oidc');
    run(() => service.destroy());
  });
});

test('tests the candidate provider with a serialized configuration', function(assert) {
  let service = createService();
  let serialized = {provider: 'oidcconfig', enabled: false};
  let config = EmberObject.create({
    serialize() {
      return serialized;
    },
  });
  let request;

  service.set('authStore', EmberObject.create({
    rawRequest(options) {
      request = options;
      return resolve({body: {identities: [{externalIdType: 'oidc_user'}]}});
    },
  }));

  return service.test(config, 'opaque-authorization-response').then((result) => {
    assert.strictEqual(request.url, 'testlogin');
    assert.strictEqual(request.method, 'POST');
    assert.strictEqual(request.data.authConfig, serialized);
    assert.strictEqual(request.data.code, 'opaque-authorization-response');
    assert.strictEqual(result.jwt, undefined, 'provider tests do not create a browser session');
    assert.strictEqual(result.identities[0].externalIdType, 'oidc_user');
    run(() => service.destroy());
  });
});
