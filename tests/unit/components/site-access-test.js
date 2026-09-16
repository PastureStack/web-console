import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import SiteAccess, {
  configUpdateErrorBody,
  configUpdateErrorCode,
} from 'ui/components/site-access/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | site access');

function identity(type, id) {
  return EmberObject.create({id: `${type}:${id}`, externalIdType: type, externalId: id});
}

function createComponent(copy, extra = {}) {
  let component;
  run(() => {
    component = createOwned(SiteAccess, Object.assign({
      renderer: inertRenderer(),
      settings: EmberObject.create(),
      access: EmberObject.create({identity: identity('oidc_user', 'admin')}),
      intl: EmberObject.create({t(key) { return key; }}),
      modalService: EmberObject.create({toggleModal() {}}),
      model: EmberObject.create({
        clone() { return copy; },
        replaceWith() {},
      }),
    }, extra), 'component');
    component.set('copy', copy);
  });
  return component;
}

test('switching to unrestricted clears the local allowlist immediately', function(assert) {
  let copy = EmberObject.create({
    accessMode: 'restricted',
    allowedIdentities: A([identity('oidc_user', 'alice')]),
  });
  let component = createComponent(copy);

  run(() => copy.set('accessMode', 'unrestricted'));
  component.accessModeChanged();

  assert.deepEqual(copy.get('allowedIdentities'), [],
    'stale restricted identities cannot be submitted under unrestricted access');
  destroyOwned(component);
});

test('deduplicates the same OIDC principal in the editor', function(assert) {
  let alice = identity('oidc_user', 'alice');
  let copy = EmberObject.create({accessMode: 'restricted', allowedIdentities: A([alice])});
  let component = createComponent(copy);

  let before = copy.get('allowedIdentities').filter((candidate) => {
    return candidate.get('externalIdType') === 'oidc_user' && candidate.get('externalId') === 'alice';
  }).length;

  component.send('addAuthorized', identity('oidc_user', 'alice'));

  let after = copy.get('allowedIdentities').filter((candidate) => {
    return candidate.get('externalIdType') === 'oidc_user' && candidate.get('externalId') === 'alice';
  }).length;
  assert.strictEqual(before, 1);
  assert.strictEqual(after, 1);
  destroyOwned(component);
});

test('retries an access expansion only with the bound MFA confirmation', async function(assert) {
  let saveCount = 0;
  let digest = 'b'.repeat(64);
  let submitted = [];
  let modalOptions;
  let copy = EmberObject.create({
    accessMode: 'unrestricted',
    allowedIdentities: A([identity('oidc_user', 'stale')]),
    save() {
      saveCount++;
      submitted.push({
        allowedIdentities: this.get('allowedIdentities').slice(),
        securityConfirmation: this.get('securityConfirmation'),
      });
      if ( saveCount === 1 ) {
        return Promise.reject({body: {
          code: 'MfaConfirmationRequired',
          requestDigest: digest,
        }});
      }
      return Promise.resolve(this);
    },
  });
  let component = createComponent(copy, {
    modalService: EmberObject.create({
      toggleModal(name, options) {
        assert.strictEqual(name, 'mfa-security-confirmation');
        modalOptions = options;
      },
    }),
  });

  let savePromise = component.saveConfiguration(() => {});
  await Promise.resolve();
  assert.strictEqual(modalOptions.purpose, 'oidcAccessPolicyUpdate');
  assert.strictEqual(modalOptions.requestDigest, digest);
  modalOptions.onComplete('one-time-ticket');
  await savePromise;

  assert.deepEqual(submitted[0].allowedIdentities, [], 'unrestricted first request clears stale identities');
  assert.strictEqual(submitted[0].securityConfirmation, undefined);
  assert.strictEqual(submitted[1].securityConfirmation, 'one-time-ticket');
  assert.strictEqual(copy.get('securityConfirmation'), null, 'ticket is removed from the model after use');
  destroyOwned(component);
});

test('extracts stable errors from direct and xhr response shapes', function(assert) {
  let direct = {
    code: 'MfaConfirmationRequired',
    requestDigest: 'd'.repeat(64),
  };
  assert.strictEqual(configUpdateErrorBody(direct), direct,
    'a top-level rejection keeps its bound MFA challenge fields');
  assert.deepEqual(configUpdateErrorBody({body: '{"code":"LocalRecoveryRequired"}'}),
    {code: 'LocalRecoveryRequired'});
  assert.deepEqual(configUpdateErrorBody({xhr: {responseJSON: {code: 'MfaConfirmationRequired'}}}),
    {code: 'MfaConfirmationRequired'});
  assert.strictEqual(configUpdateErrorCode({
    type: 'error',
    body: {code: 'InvalidAllowedIdentity'},
  }), 'InvalidAllowedIdentity', 'a structured backend code wins over a generic transport type');
});

test('rejects a malformed MFA digest without opening the modal or retrying', async function(assert) {
  let saveCount = 0;
  let modalCount = 0;
  let copy = EmberObject.create({
    save() {
      saveCount++;
      return Promise.reject({body: {
        code: 'MfaConfirmationRequired',
        requestDigest: 'not-a-sha256-digest',
      }});
    },
  });
  let component = createComponent(copy, {
    modalService: EmberObject.create({toggleModal() { modalCount++; }}),
  });

  await component.saveWithBoundConfirmation(copy, true).then(
    () => assert.ok(false, 'malformed challenge must reject'),
    () => assert.ok(true, 'malformed challenge was rejected')
  );

  assert.strictEqual(saveCount, 1, 'the request was not retried');
  assert.strictEqual(modalCount, 0, 'the MFA modal was not opened');
  destroyOwned(component);
});

test('uses one MFA retry and clears the ticket when the retry fails', async function(assert) {
  let saveCount = 0;
  let modalCount = 0;
  let modalOptions;
  let digest = 'c'.repeat(64);
  let copy = EmberObject.create({
    save() {
      saveCount++;
      return Promise.reject({body: {
        code: 'MfaConfirmationRequired',
        requestDigest: digest,
      }});
    },
  });
  let component = createComponent(copy, {
    modalService: EmberObject.create({
      toggleModal(name, options) {
        modalCount++;
        modalOptions = options;
      },
    }),
  });

  let savePromise = component.saveWithBoundConfirmation(copy, true);
  await Promise.resolve();
  modalOptions.onComplete('one-time-ticket');
  await savePromise.then(
    () => assert.ok(false, 'failed retry must reject'),
    () => assert.ok(true, 'failed retry was returned to the caller')
  );

  assert.strictEqual(saveCount, 2, 'only the initial request and one retry were sent');
  assert.strictEqual(modalCount, 1, 'only one MFA modal was opened');
  assert.strictEqual(copy.get('securityConfirmation'), null, 'ticket was cleared after failure');
  destroyOwned(component);
});

test('shows a localized stable error instead of a generic HTTP 400', function(assert) {
  let copy = EmberObject.create({accessMode: 'restricted', allowedIdentities: A([])});
  let component = createComponent(copy);

  component.send('gotError', {body: {code: 'LocalRecoveryRequired'}});

  assert.deepEqual(component.get('errors'), ['siteAccess.errors.localRecoveryRequired']);
  destroyOwned(component);
});
