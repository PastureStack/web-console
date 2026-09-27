import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';

import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';
import resolver from '../../helpers/resolver';

module('Integration | Component | confirm delete', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    this.closed = 0;
    let context = this;
    this.owner.register('service:modal', Service.extend({
      modalVisible: true,
      modalOpts: null,
      toggleModal() { context.closed++; },
    }));
    this.modal = this.owner.lookup('service:modal');
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      let messages = await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, messages);
    }
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('English and Traditional Chinese confirmation, busy, and cancel controls', async function(assert) {
    for (let [locale, confirmLabel, busyLabel, cancelLabel, failureLabel] of [
      ['en-us', 'Delete', 'Deleting...', 'Cancel', 'Error deleting'],
      ['zh-tw', '刪除', '刪除中…', '取消', '刪除失敗'],
    ]) {
      this.intl.setLocale([locale, 'en-us']);
      let operation = defer();
      let calls = 0;
      this.modal.set('modalOpts', [EmberObject.create({
        type: 'stack',
        displayName: 'Disposable Stack',
        delete() {
          calls++;
          return operation.promise;
        },
      })]);

      await render(precompileTemplate('{{confirm-delete}}'));
      assert.strictEqual(find('.footer-actions .btn-danger').textContent.trim(), confirmLabel, `${locale}: confirm label`);
      assert.strictEqual(find('.footer-actions .btn-link').textContent.trim(), cancelLabel, `${locale}: cancel label`);
      assert.strictEqual(this.intl.t('confirmDelete.deleteFailed'), failureLabel, `${locale}: failure growl title`);
      find('.footer-actions .btn-danger').click();
      await resolve();
      await resolve();
      assert.true(find('.footer-actions .btn-danger').disabled, `${locale}: confirm is locked while pending`);
      assert.true(find('.footer-actions .btn-link').disabled, `${locale}: cancel is locked while pending`);
      assert.strictEqual(find('.footer-actions .btn-danger').textContent.trim(), busyLabel, `${locale}: busy label`);
      assert.strictEqual(this.closed, locale === 'en-us' ? 0 : 2, `${locale}: no premature close`);

      operation.resolve();
      await settled();
      assert.strictEqual(calls, 1, `${locale}: one delete request`);
      assert.false(find('.footer-actions .btn-danger').disabled, `${locale}: lock released`);
      await click('.footer-actions .btn-link');
      assert.strictEqual(this.closed, locale === 'en-us' ? 2 : 4, `${locale}: success and cancel each close once`);
    }
  });

  test('the two deletion status messages exist in every supported locale', async function(assert) {
    for (let locale of [
      'de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp',
      'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw',
    ]) {
      let messages = await (await fetch(`/translations/${locale}.json`)).json();
      assert.ok(messages['confirmDelete.deleting'], `${locale}: pending deletion label`);
      assert.ok(messages['confirmDelete.deleteFailed'], `${locale}: failed deletion title`);
    }
  });

  test('real clicks show localized failures without closing the modal or logging an unhandled rejection', async function(assert) {
    let originalConsoleError = console.error;
    let consoleErrors = [];
    let unhandled = [];
    let onUnhandled = (event) => unhandled.push(event.reason);
    console.error = (...args) => {
      consoleErrors.push(args);
      return originalConsoleError.apply(console, args);
    };
    window.addEventListener('unhandledrejection', onUnhandled);

    try {
      for (let [locale, title] of [
        ['en-us', 'Error deleting'],
        ['zh-tw', '刪除失敗'],
      ]) {
        this.intl.setLocale([locale, 'en-us']);
        let failure = new Error('DELETE denied');
        let growls = [];
        let requests = 0;
        let FailingResource = EmberObject.extend({
          delete() {
            requests++;
            return reject(failure);
          },
        }, CattleTransitioningResource);
        let resource = FailingResource.create({
          type: 'stack',
          name: 'Disposable Stack',
          intl: this.intl,
          growl: EmberObject.create({fromError(...args) { growls.push(args); }}),
        });
        this.modal.set('modalOpts', [resource]);
        await render(precompileTemplate('{{confirm-delete}}'));

        await click('.footer-actions .btn-danger');
        await settled();
        assert.strictEqual(requests, 1, `${locale}: one DELETE attempt`);
        assert.deepEqual(growls, [[title, failure]], `${locale}: the existing growl reports the original error`);
        assert.strictEqual(this.closed, 0, `${locale}: rejected DELETE keeps the modal open`);
        assert.false(find('.footer-actions .btn-danger').disabled, `${locale}: retry is enabled`);
        assert.false(find('.footer-actions .btn-link').disabled, `${locale}: Cancel is enabled`);
      }
      assert.deepEqual(unhandled, [], 'no unhandled Promise rejection reached the browser');
      assert.deepEqual(consoleErrors, [], 'no rejection was logged as a console error');
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
      console.error = originalConsoleError;
    }
  });
});
