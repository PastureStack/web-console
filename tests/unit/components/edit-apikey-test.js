import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext, triggerKeyEvent, waitUntil } from '@ember/test-helpers';
import { selectChoose, selectSearch } from 'ember-power-select/test-support';
import { resolve, reject, defer } from 'rsvp';
import { takeCreateOnlyDelivery } from 'ember-api-store/utils/create-only-delivery';
import Collection from 'ember-api-store/models/collection';
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

  test('real scope child survives capability wrapper updates and renders resource stack and global drafts', async function(assert) {
    let reads = 0, reloadKey;
    let stack = EmberObject.create({id: '1st4', type: 'stack', name: 'Visible stack', accountId: '1a9',
      links: {self: '/v2-beta/projects/1a9/stacks/1st4'}, actionLinks: {}});
    let stackSchema = EmberObject.create({id: 'stack', collectionMethods: ['GET'], resourceMethods: ['GET'],
      resourceActions: {}, resourceLinks: [], links: {collection: '/stacks'}});
    let stackRows = Collection.create({content: A([{id: '1a9', name: 'Visible environment'}])});
    this.owner.register('service:store', Service.extend({generation: 1,
      getById(type, id) { return type === 'schema' && id === 'stack' ? stackSchema : null; },
      findAll() { return resolve(stackRows); }, find() { return resolve(stack); }}));
    this.owner.register('service:user-store', Service.extend({generation: 1,
      getById() { return stackSchema; },
      find(type, id, options) {
        if ( type === 'apiKey' && options.forceReload === true ) { return resolve(reloadKey); }
        if ( type !== 'project' || id !== null || options.forceReload !== true ) { throw new Error('FreshProjectCollectionRequired'); }
        return resolve(stackRows);
      },
      rawRequest(options) {
        reads++;
        if ( options.url.endsWith('/apiKeyPolicyPreview') ) {
          return resolve({body: {purpose: 'apiKeyPolicyUpdate', requestDigest: 'a'.repeat(64), confirmationRequired: false,
            apiKeyPolicy: options.data.apiKeyPolicy, apiKeyPolicyRevision: options.data.apiKeyPolicyRevision}});
        }
        return resolve({body: options.url.endsWith('/schema') ? {data: [stackSchema]} :
          options.url === '/stacks' ? {data: [stack]} : stack});
      }}));
    this.owner.register('service:projects', Service.extend({current: EmberObject.create({id: '1a9'}),
      schemaProjectId: '1a9', schemaLoadGeneration: 1}));
    this.owner.register('service:session', Service.extend({accountId: '1a1'}));
    this.owner.register('service:access', Service.extend({identity: EmberObject.create({id: 'viewer1'})}));
    this.owner.register('service:endpoint', Service.extend({absolute: 'https://platform.example/'}));
    this.owner.register('service:modal', Service.extend({modalVisible: true, modalOpts: null,
      toggleModal() { this.set('modalVisible', false); }}));
    this.modal = this.owner.lookup('service:modal');
    this.modal.set('modalOpts', key({accountId: '1a1'}, this.owner.lookup('service:user-store')));
    let clickButton = (label) => [...this.testRoot.querySelectorAll('button')].find((node) => node.textContent.trim() === label).click();
    let change = async (node, value) => { node.value = value; node.dispatchEvent(new Event('change', {bubbles: true})); await settled(); };
    let targetView = () => Object.values(this.owner.lookup('-view-registry:main')).find((view) =>
      typeof view.loadContext === 'function' && typeof view.publish === 'function' && !view.isDestroyed && !view.isDestroying);

    try {
      await render(precompileTemplate('{{#if this.modal.modalVisible}}{{edit-apikey}}{{/if}}'));
      assert.ok(find('[data-policy-matrix="draft"]'), 'the actual form shows its matrix before review');
      assert.strictEqual(find('[data-policy-matrix] thead tr').children.length, 9, 'resource plus all eight operations');
      assert.strictEqual(find('[data-matrix-operation="read"]').dataset.matrixState, 'allow', 'the initial full policy is not restricted');
      clickButton('Deny by default (whitelist)'); await settled();
      assert.strictEqual(find('[data-matrix-operation="read"]').dataset.matrixState, 'deny', 'base choice immediately updates the preview');
      clickButton('Add exception'); await settled();
      let originalChild = targetView();
      assert.ok(originalChild, 'the real scope component runs its lifecycle');
      assert.ok(find('[data-scope-selector="project"] .ember-power-select-trigger'), 'real ArrayProxy projects render a searchable selector');
      assert.notOk(find('.api-key-rule input[type="text"]'), 'there is no raw resource ID field');
      let projectTrigger = find('[data-scope-selector="project"] .ember-power-select-trigger');
      assert.ok(find('.api-key-scope-target'), 'focus and wrapping styles use the scope-only namespace');
      assert.strictEqual(projectTrigger.tabIndex, 0, 'selector is in the keyboard tab sequence');
      assert.strictEqual(document.getElementById(projectTrigger.getAttribute('aria-labelledby')).textContent.trim(), 'Environment');
      projectTrigger.focus(); await settled();
      let focusStyle = getComputedStyle(projectTrigger);
      assert.strictEqual(focusStyle.outlineStyle, 'solid');
      assert.strictEqual(focusStyle.outlineWidth, '2px');
      assert.notOk(/rgba\([^)]*,\s*0\)|transparent/.test(focusStyle.outlineColor), 'compiled keyboard focus is nontransparent');
      assert.strictEqual(getComputedStyle(find('.api-key-scope-target')).minWidth, '0px');
      let selects = () => this.testRoot.querySelectorAll('.api-key-rule .row select:not([aria-label])');
      await change(selects()[1], 'resource');
      assert.ok(selects()[2], 'resource type control is rendered after a normal DOM change');
      await change(selects()[2], 'stack');
      await waitUntil(() => !targetView().get('loading'));
      assert.deepEqual(targetView().get('projectOptions').map((option) => option.label), ['Visible environment']);
      await selectChoose('[data-scope-selector="project"]', 'Visible environment');
      await waitUntil(() => !targetView().get('loading'));
      await selectSearch('[data-scope-selector="resource"]', 'No such name');
      assert.ok(document.body.textContent.includes('No matching resource names'), 'search has a localized no-result message');
      await triggerKeyEvent(document.querySelector('.ember-power-select-search-input'), 'keydown', 'Escape');
      await selectSearch('[data-scope-selector="resource"]', 'Visible stack');
      await triggerKeyEvent(document.querySelector('.ember-power-select-search-input'), 'keydown', 'ArrowDown');
      await triggerKeyEvent(document.querySelector('.ember-power-select-search-input'), 'keydown', 'Enter');
      await waitUntil(() => !targetView().get('loading'));
      assert.strictEqual(targetView(), originalChild, 'capability callback updates wrappers without remounting the child');
      let selectedReads = reads;
      await settled();
      assert.strictEqual(reads, selectedReads, 'selected-scope evidence does not cause a remount/request loop');
      assert.notOk(this.testRoot.textContent.includes('1st4'), 'stable resource IDs never appear as displayed names');
      assert.ok(find('[data-matrix-row="resource"] th').textContent.includes('Visible stack'), 'matrix uses the selected human path');
      assert.strictEqual(find('[data-matrix-row="resource"] [data-matrix-operation="read"]').dataset.matrixState, 'allow');
      assert.strictEqual(getComputedStyle(find('.api-key-policy-matrix-scroll')).overflowX, 'auto', 'wide matrix scrolls within the modal');
      assert.strictEqual(find('.api-key-policy-matrix-scroll').tabIndex, 0, 'matrix region is keyboard accessible');
      let editorView = Object.values(this.owner.lookup('-view-registry:main')).find((view) =>
        typeof view.resetPolicy === 'function' && !view.isDestroyed && !view.isDestroying);
      reloadKey = key({accountId: '1a1', apiKeyPolicy: editorView.get('policyDraft'), apiKeyPolicyRevision: 2},
        this.owner.lookup('service:user-store'));
      stack.set('name', 'Refreshed stack');
      editorView.set('conflict', true); await settled();
      let reloadGeneration = editorView.get('scopeReloadGeneration');
      clickButton('Reload latest revision');
      await waitUntil(() => editorView.get('scopeReloadGeneration') > reloadGeneration && !targetView().get('loading'));
      await settled();
      assert.strictEqual(targetView(), originalChild, 'official reload keeps the same mounted scope child');
      assert.ok(reads > selectedReads, 'reload verifies fresh resource evidence rather than reusing old authorization');
      assert.ok(find('[data-matrix-row="resource"] th').textContent.includes('Refreshed stack'), 'reload restores the fresh human path');
      assert.strictEqual(find('[data-matrix-row="resource"] [data-matrix-operation="read"]').dataset.matrixState, 'allow');
      let reloadReads = reads;
      await settled();
      assert.strictEqual(reads, reloadReads, 'restored parent evidence does not start a request loop');
      clickButton('Review changes'); await settled();
      assert.ok(find('[data-policy-matrix="reviewed"]'), 'reloaded target can be reviewed again');
      assert.ok(find('[data-matrix-row="resource"] th').textContent.includes('Refreshed stack'), 'review uses refreshed names');
      editorView.invalidateReview(); await settled();
      let intl = this.owner.lookup('service:intl');
      intl.addTranslations('zh-tw', await (await fetch('/translations/zh-tw.json')).json());
      intl.setLocale(['zh-tw']);
      await waitUntil(() => !targetView().get('loading')); await settled();
      assert.strictEqual(document.getElementById(find('[data-scope-selector="project"] .ember-power-select-trigger').getAttribute('aria-labelledby')).textContent.trim(), '環境');
      assert.ok(this.testRoot.textContent.includes('目前可見資源'));
      assert.notOk(this.testRoot.textContent.includes('apiKeyAccess.selector.'), 'both locale selectors resolve their translation keys');
      assert.ok(this.testRoot.textContent.includes('存取矩陣預覽'), 'the matrix switches to Traditional Chinese');
      assert.ok(this.testRoot.textContent.includes('金鑰規則允許'));
      assert.notOk(this.testRoot.textContent.includes('apiKeyAccess.matrix.'), 'matrix states and reasons are translated');
      assert.strictEqual(getComputedStyle(find('[data-scope-selector="resource"] .ember-power-select-selected-item')).whiteSpace, 'normal', 'selected paths wrap instead of clipping');
      intl.setLocale(['en-us']);
      await waitUntil(() => !targetView().get('loading')); await settled();
      assert.strictEqual(find('input[data-operation="read"]').dataset.capability, 'observed');
      assert.ok(find('input[data-operation="update"]').disabled, 'confirmed missing PUT disables only custom allow');
      await change(selects()[1], 'global');
      assert.notOk(find('[data-scope-selector]'), 'global intentionally has no target child');
      assert.ok([...this.testRoot.querySelectorAll('input[data-capability]')].every((node) =>
        node.dataset.capability === 'unknown' && !node.disabled), 'global never borrows the prior project evidence');
      clickButton('Review changes'); await settled();
      assert.ok(find('[data-policy-matrix="reviewed"]'), 'the server-reviewed snapshot has a visible matrix');
      assert.notOk(find('[data-policy-matrix="draft"]'), 'review does not silently render mutable draft values');
      assert.strictEqual(find('[data-matrix-operation="read"]').dataset.matrixState, 'allow', 'global allow applies to the other-resources row');
      await change(selects()[1], 'stack');
      assert.ok(find('[data-policy-matrix="draft"]'), 'changing a target invalidates the reviewed snapshot');
      assert.notOk(find('[data-policy-matrix="reviewed"]'));
      assert.ok(find('[data-scope-selector="project"] .ember-power-select-trigger'), 'returning to stack creates one healthy scope component');
      assert.ok([...this.testRoot.querySelectorAll('input[data-capability]')].every((node) =>
        node.dataset.capability === 'unknown' && !node.disabled), 'unselected stack remains explicitly unknown');
      clickButton('Cancel'); await settled();
    } finally {
      stackRows.destroy();
    }
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
    session: EmberObject.create({accountId: '1a1'}),
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

test('custom allow blocks only verified unavailable operations; deny and unknown remain distinct', function(assert) {
  let component = editor(previewStore(), {accountId: '1a1'});
  let scope = {kind: 'resource', resourceType: 'container', resourceId: '1i42'};
  component.set('policyDraft', {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
    rules: [{id: 'r1', effect: 'allow', scope, operations: ['read']}]});
  component.send('scopeCapabilities', 'r1', {scopeKey: 'resource:container:1i42', contextVerified: true, complete: true,
    schemas: [{id: 'container', collectionMethods: ['GET'], resourceMethods: ['GET'], resourceActions: {logs: {}}, resourceLinks: []}],
    resource: {id: '1i42', type: 'container', actionLinks: {logs: '/logs'}}});
  let cells = component.get('rules')[0].operationsView;
  assert.ok(cells.find((cell) => cell.operation === 'exec').disabled);
  assert.notOk(cells.find((cell) => cell.operation === 'logs').disabled);
  assert.strictEqual(cells.find((cell) => cell.operation === 'create').status, 'unknown');
  component.send('ruleOperation', 'r1', 'exec', {target: {checked: true}});
  assert.deepEqual(component.get('policyDraft.rules')[0].operations, ['read'], 'programmatic events cannot grant a known unavailable cell');
  component.send('ruleField', 'r1', 'effect', {target: {value: 'deny'}});
  assert.notOk(component.get('rules')[0].operationsView.some((cell) => cell.disabled), 'a deny rule may restrict future operations');
  component.send('ruleOperation', 'r1', 'exec', {target: {checked: true}});
  assert.ok(component.get('policyDraft.rules')[0].operations.includes('exec'));
  destroyOwned(component);
});

test('full and closed keep canonical saving; another owner never borrows editor authority', function(assert) {
  let component = editor(previewStore(), {accountId: '1aOther'});
  assert.notOk(component.get('ownerContextKnown'));
  component.send('selectMode', 'custom'); component.send('addRule');
  assert.ok(component.get('rules')[0].operationsView.every((cell) => cell.status === 'unknown' && !cell.disabled));
  component.send('selectMode', 'full');
  assert.strictEqual(component.get('policyDraft.defaultEffect'), 'allow');
  component.send('selectMode', 'closed');
  assert.strictEqual(component.get('policyDraft.defaultEffect'), 'deny');
  assert.strictEqual(component.get('policyDraft.mode'), 'custom', 'a base change retains explicit exceptions');
  assert.strictEqual(component.get('policyDraft.rules').length, 1);
  component.send('removeRule', component.get('policyDraft.rules')[0].id);
  assert.strictEqual(component.get('policyDraft.mode'), 'closed', 'without exceptions the original closed contract remains');
  destroyOwned(component);
});

test('both defaults directly add opposite exceptions without a hidden custom step', function(assert) {
  let component = editor(previewStore());
  component.send('addRule');
  let denied = component.get('policyDraft.rules')[0];
  assert.strictEqual(component.get('policyDraft.mode'), 'custom');
  assert.strictEqual(component.get('policyDraft.defaultEffect'), 'allow');
  assert.strictEqual(denied.effect, 'deny', 'a blacklist starts with a deny exception');
  component.set('review', {requestDigest: 'a'.repeat(64)});
  component.set('confirmed', true);
  component.send('selectMode', 'closed');
  assert.strictEqual(component.get('review'), null, 'a base change invalidates the old review');
  assert.notOk(component.get('confirmed'));
  assert.deepEqual(component.get('policyDraft.rules'), [denied], 'switching the base never erases exceptions');
  component.send('addRule');
  assert.strictEqual(component.get('policyDraft.defaultEffect'), 'deny');
  assert.strictEqual(component.get('policyDraft.rules')[1].effect, 'allow', 'a whitelist starts with an allow exception');
  assert.strictEqual(component.get('policyDraft.rules')[1].scope.kind, 'stack', 'default deny is not a global deny rule');
  component.send('removeRule', denied.id);
  component.send('removeRule', component.get('policyDraft.rules')[0].id);
  assert.strictEqual(component.get('policyDraft.mode'), 'closed');
  component.send('selectMode', 'full');
  assert.strictEqual(component.get('policyDraft.mode'), 'full', 'no exceptions means original full access');
  assert.deepEqual(component.get('policyDraft.rules'), []);
  component.set('confirmationOptions', {purpose: 'apiKeyPolicyUpdate'});
  component.send('addRule'); component.send('selectMode', 'closed');
  assert.strictEqual(component.get('policyDraft.mode'), 'full', 'an active confirmation cannot mutate its reviewed payload');
  destroyOwned(component);
});

test('blacklist and whitelist exceptions are reviewed, saved and read back using custom wire semantics', async function(assert) {
  for ( let base of ['full', 'closed'] ) {
    let sent;
    let policy;
    let store = previewStore({
      save(copy, options) { sent = options.data; policy = JSON.parse(JSON.stringify(sent.apiKeyPolicy));
        return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: policy, apiKeyPolicyRevision: 2}, store)); },
      find() { return resolve(key({type: 'apiKeyRestricted', apiKeyPolicy: policy, apiKeyPolicyRevision: 2}, store)); },
    });
    let component = editor(store, {accountId: '1a1'});
    component.send('selectMode', base); component.send('addRule');
    let id = component.get('policyDraft.rules')[0].id;
    component.send('ruleField', id, 'kind', {target: {value: 'global'}});
    await component.reviewDraft(); component.set('confirmed', true);
    await component.submitPolicy();
    assert.strictEqual(sent.apiKeyPolicy.mode, 'custom');
    assert.strictEqual(sent.apiKeyPolicy.defaultEffect, base === 'full' ? 'allow' : 'deny');
    assert.strictEqual(sent.apiKeyPolicy.rules[0].effect, base === 'full' ? 'deny' : 'allow');
    assert.ok(component.get('savedReadback'));
    assert.strictEqual(component.get('policyDraft.rules').length, 1, 'fresh readback keeps the exception');
    assert.notOk(component.get('readbackPending'));
    destroyOwned(component);
  }
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

test('matrix preview and review keep the same safe evidence; changed parent invalidates approval', async function(assert) {
  let component = editor(previewStore(), {accountId: '1a1'});
  component.set('policyDraft', {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
    rules: [{id: 'r1', effect: 'allow', scope: {kind: 'stack', resourceId: '1st4'}, operations: ['read']}]});
  let evidence = {scopeKey: 'stack::1st4', selectionValid: true, selectionLabel: 'Production / Web',
    selectionStatus: 'ready', contextVerified: true, complete: true, projectId: '1a9', stackId: '1st4',
    resource: {id: '1st4', type: 'stack', accountId: '1a9'}, schemas: [{secret: 'NOT-IN-SNAPSHOT'}]};
  component.send('scopeCapabilities', 'r1', evidence);
  let draft = component.get('draftMatrix');
  await component.reviewDraft();
  assert.deepEqual(component.get('reviewMatrix'), draft, 'the confirmed preview is the exact policy and evidence snapshot');
  assert.notOk(JSON.stringify(component.get('review.matrixEvidence')).includes('NOT-IN-SNAPSHOT'), 'schema or payload contents are not copied');
  component.send('scopeCapabilities', 'r1', Object.assign({}, evidence, {projectId: '1a10'}));
  assert.strictEqual(component.get('review'), null, 'the same label cannot hide a changed parent');
  destroyOwned(component);
});

test('matrix wakes exactly at expiry and releases its timer on destroy without polling', async function(assert) {
  let component = editor(previewStore());
  let now = 1800000000000, callback, delay, cleared = [];
  let originalNow = Date.now, originalTimeout = window.setTimeout, originalClear = window.clearTimeout;
  try {
    Date.now = () => now;
    window.setTimeout = (work, value) => { callback = work; delay = value; return 9876; };
    window.clearTimeout = (id) => cleared.push(id);
    component.set('policyDraft.expiresAt', new Date(now + 10000).toISOString());
    assert.strictEqual(delay, 10000, 'one deadline wake, not an interval');
    assert.ok(component.get('draftMatrix').rows[0].cells.every((cell) => cell.state === 'allow'));
    now += 10000; callback();
    assert.ok(component.get('draftMatrix').rows[0].cells.every((cell) => cell.state === 'deny' && cell.basis === 'expired'));
    assert.strictEqual(component._matrixExpiryTimer, null, 'expired preview schedules no more work');
    component.set('policyDraft.expiresAt', new Date(now + 20000).toISOString());
    // Multiple sets in this synchronous unit test share one Ember run loop;
    // flush the deadline calculation before testing the destruction hook.
    component.updateMatrixClock();
    assert.strictEqual(component._matrixExpiryTimer, 9876, 'a future deadline is actually owned');
    let clearsBeforeDestroy = cleared.length;
    // This owned unit subject uses an inert renderer (no DOM lifetime). Exercise
    // the DOM teardown hook while the clock doubles are still installed.
    component.willDestroyElement();
    assert.deepEqual(cleared.slice(clearsBeforeDestroy), [9876], 'destroy releases the owned future deadline');
    assert.strictEqual(component._matrixExpiryTimer, null);
    component.updateMatrixClock();
    clearsBeforeDestroy = cleared.length;
    component.willDestroy();
    assert.deepEqual(cleared.slice(clearsBeforeDestroy), [9876], 'owner-only teardown also releases its timer');
    assert.strictEqual(component._matrixExpiryTimer, null);
  } finally {
    Date.now = originalNow; window.setTimeout = originalTimeout; window.clearTimeout = originalClear;
    if ( !component.isDestroyed && !component.isDestroying ) { destroyOwned(component); }
  }
});

test('review expiry disables saving and a late MFA result cannot send an expired mutation', async function(assert) {
  let writes = 0;
  let component = editor(previewStore({save() { writes++; return resolve(); }}));
  let now = Date.now(), originalNow = Date.now;
  try {
    component.set('policyDraft.expiresAt', new Date(now + 10000).toISOString());
    await component.reviewDraft();
    component.set('confirmed', true);
    assert.notOk(component.get('submitDisabled'), 'a valid reviewed deadline can be saved');
    Date.now = () => now + 10000;
    component.updateMatrixClock();
    assert.ok(component.get('submitDisabled'), 'the preview and save state expire together');
    await component.submitPolicy('late-confirmation-test-only');
    assert.strictEqual(writes, 0, 'confirmation never bypasses the deadline');
    assert.strictEqual(component.get('policyError'), 'apiKeyAccess.errors.expiry');
    assert.notOk(component.get('confirmed'));
  } finally {
    Date.now = originalNow;
    destroyOwned(component);
  }
});

test('a changed selector during a pending preview is not adopted into review', async function(assert) {
  let pending = defer();
  let sent;
  let component = editor(previewStore({rawRequest(options) { sent = options.data; return pending.promise; }}), {accountId: '1a1'});
  component.set('policyDraft', {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
    rules: [{id: 'r1', effect: 'allow', scope: {kind: 'stack', resourceId: '1st4'}, operations: ['read']}]});
  let evidence = {scopeKey: 'stack::1st4', selectionValid: true, selectionLabel: 'Production / Web',
    selectionStatus: 'ready', contextVerified: true, complete: true, projectId: '1a9',
    resource: {id: '1st4', type: 'stack', accountId: '1a9'}};
  component.send('scopeCapabilities', 'r1', evidence);
  let review = component.reviewDraft();
  component.send('scopeCapabilities', 'r1', Object.assign({}, evidence, {selectionLabel: 'Production / Renamed Web'}));
  pending.resolve({body: {purpose: 'apiKeyPolicyUpdate', requestDigest: 'a'.repeat(64),
    apiKeyPolicy: sent.apiKeyPolicy, apiKeyPolicyRevision: sent.apiKeyPolicyRevision}});
  await review;
  assert.strictEqual(component.get('review'), null, 'late selection cannot make the reviewed matrix disagree with the draft');
  assert.strictEqual(component.get('policyError'), 'apiKeyAccess.errors.review');
  destroyOwned(component);
});

test('invalid or unresolved named selection prevents preview; review keeps a human path and stable wire ID', async function(assert) {
  let requests = [];
  let store = previewStore({rawRequest(options) { requests.push(options); return resolve({body: {
    purpose: 'apiKeyPolicyUpdate', requestDigest: 'a'.repeat(64), confirmationRequired: false,
    apiKeyPolicy: options.data.apiKeyPolicy, apiKeyPolicyRevision: options.data.apiKeyPolicyRevision,
  }}); }});
  let component = editor(store, {accountId: '1a1'});
  component.set('policyDraft', {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
    rules: [{id: 'r1', effect: 'allow', scope: {kind: 'stack', resourceId: '1st4'}, operations: ['read']}]});
  await component.reviewDraft();
  assert.strictEqual(requests.length, 0, 'unresolved names never request preview');
  assert.strictEqual(component.get('policyError'), 'apiKeyAccess.selector.unavailable');
  component.send('scopeCapabilities', 'r1', {scopeKey: 'stack::1st4', selectionValid: true,
    selectionLabel: 'Production / Web', selectionStatus: 'ready', contextVerified: true, complete: true, schemas: []});
  await component.reviewDraft();
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].data.apiKeyPolicy.rules[0].scope.resourceId, '1st4', 'DTO keeps the stable reference');
  assert.strictEqual(requests[0].data.scopeLabels, undefined, 'display labels are not public DTO fields');
  assert.strictEqual(component.get('reviewRules')[0].targetLabel, 'Production / Web');
  assert.deepEqual(component.get('reviewRules')[0].operationLabels, ['apiKeyAccess.operations.read'], 'review uses the same translated operation labels as the matrix');
  component.send('scopeCapabilities', 'r1', {scopeKey: 'stack::1st4', selectionValid: false, selectionStatus: 'unavailable'});
  assert.strictEqual(component.get('review'), null, 'losing the verified name context invalidates review');
  await component.reviewDraft();
  assert.strictEqual(requests.length, 1, 'invalid context cannot request a new preview');
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
