import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { resolve, reject, defer } from 'rsvp';
import { takeCreateOnlyDelivery } from 'ember-api-store/utils/create-only-delivery';
import { module, test } from 'qunit';

import EditApiKey from 'ui/components/edit-apikey/component';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';
import resolver from '../../helpers/resolver';

module('Unit | Component | edit apikey');

test('cancel clears delayed focus; a stale callback has no input and cannot write', function(assert) {
  let closed = 0;
  let writes = 0;
  let focus = 0;
  let inputPresent = true;
  let scheduled;
  let cleared;
  let originalSetTimeout = window.setTimeout;
  let originalClearTimeout = window.clearTimeout;
  let component = createOwned(EditApiKey, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    modalService: EmberObject.create({
      modalOpts: null,
      toggleModal() { closed++; inputPresent = false; },
    }),
    model: EmberObject.create({save() { writes++; }}),
    $() { return inputPresent ? [{focus() { focus++; }}] : []; },
  }, 'component');

  try {
    window.setTimeout = (callback, delay) => {
      assert.strictEqual(delay, 250);
      scheduled = callback;
      return 12345;
    };
    window.clearTimeout = (timer) => { cleared = timer; };

    component.didInsertElement();
    component.get('actions').cancel.call(component);
    component.willDestroyElement();
  } finally {
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
  }

  assert.strictEqual(closed, 1, 'Cancel closes the modal');
  assert.strictEqual(cleared, 12345, 'destroy clears the delayed callback');
  assert.strictEqual(component._focusTimer, null, 'timer ownership is released');
  scheduled();
  assert.strictEqual(focus, 0, 'a stale callback cannot focus a missing input');
  assert.strictEqual(writes, 0, 'Cancel and focus never save the API key');
  destroyOwned(component);
});

module('Integration | Component | edit apikey rapid cancel', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    let intl = this.owner.lookup('service:intl');
    let messages = await (await fetch('/translations/en-us.json')).json();
    intl.addTranslations('en-us', messages);
    intl.setLocale(['en-us']);
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('real Cancel destroys the modal before delayed focus and never saves', async function(assert) {
    let writes = 0;
    let closes = 0;
    let pageErrors = [];
    let onError = (event) => pageErrors.push(event.message);
    let newKey = () => EmberObject.create({
      name: 'Disposable test key',
      description: '',
      clone: newKey,
      save() { writes++; },
    });

    this.owner.register('service:modal', Service.extend({
      modalVisible: true,
      modalOpts: null,
      toggleModal() { closes++; this.set('modalVisible', false); },
    }));
    this.modal = this.owner.lookup('service:modal');
    this.modal.set('modalOpts', newKey());
    window.addEventListener('error', onError);

    try {
      await render(precompileTemplate('{{#if this.modal.modalVisible}}{{edit-apikey}}{{/if}}'));
      assert.ok(find('input[type="text"]'), 'the new key form has a real focus target');
      find('.footer-actions .btn-link').click();
      await settled();
      assert.notOk(find('input[type="text"]'), 'Cancel removes the input before the delayed callback');
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      assert.deepEqual(pageErrors, [], 'the former focus callback causes no page error');
      assert.strictEqual(closes, 1, 'Cancel closes the modal once');
      assert.strictEqual(writes, 0, 'Cancel never writes an API key');
    } finally {
      window.removeEventListener('error', onError);
    }
  });

  test('a denied Save shows a safe error without exposing key values', async function(assert) {
    let writes = 0;
    let newKey = () => EmberObject.create({
      name: 'Disposable test key',
      publicValue: 'PUBLIC-NEVER-RENDER',
      secretValue: 'SECRET-NEVER-RENDER',
      clone: newKey,
      validationErrors() { return A([]); },
      save() {
        writes++;
        return reject({status: 403, message: 'You do not have permission to create API keys.'});
      },
    });

    this.owner.register('service:modal', Service.extend({
      modalVisible: true,
      modalOpts: null,
      toggleModal() { this.set('modalVisible', false); },
    }));
    this.modal = this.owner.lookup('service:modal');
    this.modal.set('modalOpts', newKey());

    await render(precompileTemplate('{{#if this.modal.modalVisible}}{{edit-apikey}}{{/if}}'));
    find('.footer-actions .btn-primary').click();
    await settled();

    assert.strictEqual(writes, 1, 'one save attempt reached the resource');
    assert.strictEqual(find('.top-errors li').textContent.trim(),
      this.owner.lookup('service:intl').t('resourceSaveError.unavailable'),
      'the localized denial is visible without exposing the API response');
    assert.notOk(this.testRoot.textContent.includes('PUBLIC-NEVER-RENDER'), 'the public key is not in the failed form');
    assert.notOk(this.testRoot.textContent.includes('SECRET-NEVER-RENDER'), 'the secret key is not in the failed form');
  });
});

module('Unit | Component | API key editor');

function key(values, store) {
  return EmberObject.create(Object.assign({
    id: '1a1', type: 'apiKey', name: 'key', description: '', apiKeyPolicyRevision: 1,
    apiKeyPolicy: {mode: 'full', defaultEffect: 'allow', expiresAt: null, rules: []},
    schema: {resourceFields: {apiKeyPolicy: {}}}, store,
    links: {self: 'https://platform.example/v2-beta/apikey/1a1'},
    clone() { return key(this.getProperties('id', 'type', 'name', 'description', 'apiKeyPolicyRevision', 'apiKeyPolicy', 'schema', 'secretValue', 'links'), store); },
    merge(value) { this.setProperties(value.getProperties('id', 'type', 'name', 'description', 'apiKeyPolicyRevision', 'apiKeyPolicy')); },
    request(options) { this.setProperties(options.data); return store.save(this, options); },
  }, values));
}

function editor(store, values) {
  let component = createOwned(EditApiKey, {
    renderer: inertRenderer(), originalModel: key(values, store),
    intl: EmberObject.create({t(value) { return value; }}),
    userStore: store, endpoint: EmberObject.create({absolute: 'https://platform.example/'}),
    modalService: EmberObject.create({modalOpts: EmberObject.create(), toggleModal() {}}),
  }, 'component');
  component.didReceiveAttrs();
  return component;
}

function previewStore(extra) {
  return EmberObject.create(Object.assign({
    rawRequest(options) { return resolve({body: {purpose: 'apiKeyPolicyUpdate', requestDigest: 'a'.repeat(64), confirmationRequired: false,
      apiKeyPolicy: options.data.apiKeyPolicy, apiKeyPolicyRevision: options.data.apiKeyPolicyRevision}}); },
  }, extra));
}

test('schema gates advanced controls and a new draft starts full', function(assert) {
  let component = editor(previewStore(), {id: null, apiKeyPolicy: null, apiKeyPolicyRevision: 0});
  assert.ok(component.get('policySupported'));
  assert.strictEqual(component.policyFailureLabel({code: 'OwnerPermissionDenied'}, 'fallback'), 'apiKeyAudit.reasons.OwnerPermissionDenied', 'live owner denial gets safe human wording');
  assert.strictEqual(component.policyFailureLabel({code: 'UnknownFutureCode', message: 'password=secret'}, 'fallback'), 'fallback', 'unknown response text is never displayed');
  assert.strictEqual(component.get('policyDraft.mode'), 'full');
  assert.strictEqual(component.get('policyDraft.defaultEffect'), 'allow', 'full matches the fixed server mode contract');
  component.set('originalModel.schema', {resourceFields: {}});
  assert.notOk(component.get('policySupported'), 'legacy backend uses its existing workflow');
  destroyOwned(component);
});

test('legacy edit still closes after its existing save lifecycle', function(assert) {
  let component = editor(previewStore(), {schema: {resourceFields: {}}});
  let closed = 0;
  component.get('modalService').toggleModal = () => closed++;
  component.set('saving', true);
  component.doneSaving(component.get('originalModel'));
  assert.strictEqual(closed, 1, 'the legacy mixin calls doneSaving before releasing its saving lock');
  destroyOwned(component);
});

test('review uses the server digest and changing draft metadata invalidates approval', async function(assert) {
  let component = editor(previewStore());
  await component.reviewDraft();
  assert.strictEqual(component.get('review.requestDigest'), 'a'.repeat(64));
  component.set('confirmed', true);
  component.set('model.name', 'changed');
  assert.strictEqual(component.get('review'), null);
  assert.notOk(component.get('confirmed'));
  destroyOwned(component);
});

test('MFA remains inline and binds the exact server-reviewed snapshot before any save', async function(assert) {
  let saves = 0;
  let store = previewStore({save() { saves++; }});
  let component = editor(store);
  await component.reviewDraft();
  component.set('review.confirmationRequired', true);
  component.set('confirmed', true);
  await component.submitPolicy();
  assert.strictEqual(saves, 0);
  assert.strictEqual(component.get('confirmationOptions.purpose'), 'apiKeyPolicyUpdate');
  assert.strictEqual(component.get('confirmationOptions.requestDigest'), 'a'.repeat(64));
  component.get('confirmationOptions.onCancel')();
  assert.strictEqual(component.get('confirmationOptions'), null);
  assert.notOk(component.get('confirmed'));
  destroyOwned(component);
});

test('409 never silently rebases or resubmits the old draft', async function(assert) {
  let saves = 0;
  let store = previewStore({save() { saves++; return reject({status: 409, body: {code: 'ApiKeyPolicyConflict'}}); }});
  let component = editor(store);
  await component.reviewDraft();
  component.set('confirmed', true);
  await component.submitPolicy();
  assert.strictEqual(saves, 1);
  assert.ok(component.get('conflict'));
  assert.strictEqual(component.get('review'), null);
  assert.ok(component.get('reviewDisabled'));
  destroyOwned(component);
});

test('save needs matching fresh readback, and uses returned subtype for restricted keys', async function(assert) {
  let findType;
  let store = previewStore({
    save(copy) { return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: copy.get('apiKeyPolicy'), apiKeyPolicyRevision: 2}, store)); },
    find(type) { findType = type; return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: {mode: 'closed', expiresAt: null, rules: []}, apiKeyPolicyRevision: 2}, store)); },
  });
  let component = editor(store);
  component.send('selectMode', 'closed');
  await component.reviewDraft();
  component.set('confirmed', true);
  await component.submitPolicy();
  assert.strictEqual(findType, 'apiKeyRestricted');
  assert.ok(component.get('savedReadback'));
  assert.notOk(component.get('readbackPending'));
  assert.strictEqual(component.get('originalModel.apiKeyPolicy.mode'), 'closed');
  destroyOwned(component);
});

test('post-save readback failure locks creation retry and offers a fresh read', async function(assert) {
  let store = previewStore({
    save(copy) { return resolve(key({apiKeyPolicy: copy.get('apiKeyPolicy'), apiKeyPolicyRevision: 1}, store)); },
    find() { return reject({status: 403}); },
  });
  let component = editor(store, {id: null, apiKeyPolicyRevision: 0});
  await component.reviewDraft();
  component.set('confirmed', true);
  await component.submitPolicy();
  assert.ok(component.get('readbackPending'));
  assert.ok(component.get('reviewDisabled'));
  assert.strictEqual(component.get('policyError'), 'apiKeyAccess.errors.readback');
  assert.strictEqual(component.get('originalModel.id'), '1a1', 'the created stable ID is retained to avoid duplicate POST');
  destroyOwned(component);
});

test('submission is single-flight and sends only writable DTO fields', async function(assert) {
  let pending = defer();
  let requests = [];
  let store = previewStore({
    save(copy, options) { requests.push(options); return pending.promise; },
    find() { return resolve(key({apiKeyPolicyRevision: 2}, store)); },
  });
  let component = editor(store, {secretValue: 'an-existing-secret', ownerAccountId: 'readonly-owner'});
  await component.reviewDraft();
  component.set('confirmed', true);
  let first = component.submitPolicy();
  await resolve();
  await component.submitPolicy();
  assert.strictEqual(requests.length, 1, 'duplicate clicks never issue another mutation');
  assert.deepEqual(Object.keys(requests[0].data).sort(), ['apiKeyPolicy', 'apiKeyPolicyRevision', 'description', 'name']);
  assert.strictEqual(requests[0].method, 'PUT');
  pending.resolve(key({apiKeyPolicyRevision: 2}, store));
  await first;
  assert.ok(component.get('savedReadback'));
  destroyOwned(component);

  let deliveredFields = {secretValue: 'create-only-test-secret'};
  let createStore = previewStore({
    generation: 1, baseUrl: 'https://platform.example/v2-beta',
    getById() { return EmberObject.create({store: this, resourceFields: {secretValue: {readOnCreateOnly: true}}}); },
    save(copy, options) {
      assert.strictEqual(options.createIdentity.type, 'apikeyrestricted', 'actual restricted kind is bound before import');
      assert.deepEqual(options.createIdentity.readOnCreateFields, ['secretValue']);
      let deliver = takeCreateOnlyDelivery(options);
      deliver({id: '1a1', type: 'apikeyrestricted', store: this, generation: 1, baseUrl: this.get('baseUrl'),
        fields: deliveredFields});
      return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: copy.get('apiKeyPolicy'), apiKeyPolicyRevision: 1, secretValue: null}, this));
    },
    find() { return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: {mode: 'closed', defaultEffect: 'deny', expiresAt: null, rules: []}, apiKeyPolicyRevision: 1}, this)); },
  });
  let created = editor(createStore, {id: null, apiKeyPolicyRevision: 0});
  created.send('selectMode', 'closed');
  await created.reviewDraft();
  created.set('confirmed', true);
  await created.submitPolicy();
  assert.ok(created.get('justCreated'), 'the one-time modal follows actual restricted readback');
  assert.strictEqual(created.get('clone.secretValue'), 'create-only-test-secret', 'one-time secret is delivered only to this modal');
  assert.strictEqual(created.get('originalModel.secretValue'), undefined, 'the canonical original never receives the secret');
  assert.strictEqual(created.get('review'), null, 'review is discarded and does not retain a credential');
  created.willDestroyElement();
  destroyOwned(created);
  assert.strictEqual(created._createdSecret, null, 'modal destruction clears its only delivery');
});
