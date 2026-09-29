import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { reject } from 'rsvp';
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
