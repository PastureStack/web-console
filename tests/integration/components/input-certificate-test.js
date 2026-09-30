import EmberObject from '@ember/object';
import Component from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import { findAll, render, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';
import resolver from '../../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';

module('Integration | Component | input certificate', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    this.owner.register('component:input-text-file', Component.extend({tagName: 'div'}));
    await setupRenderingContext(this);
    this.model = EmberObject.create({key: null, cert: 'SYNTHETIC', certChain: null});
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('create and edit key indicators follow their explicit validation context in three locales', async function(assert) {
    for (const locale of ['en-us', 'zh-tw', 'ja-jp']) {
      this.intl.addTranslations(locale, await (await fetch(`/translations/${locale}.json`)).json());
      this.intl.setLocale([locale, 'en-us']);
      await render(precompileTemplate('{{input-certificate model=this.model}}'));
      assert.true(findAll('label')[0].textContent.trim().endsWith('*'), `${locale}: create requires a key`);
      await render(precompileTemplate('{{input-certificate model=this.model keyRequired=false}}'));
      const labels = findAll('label').map(label => label.textContent.trim());
      assert.false(labels[0].endsWith('*'), `${locale}: masked edit key is not unconditionally required`);
      assert.true(labels[1].endsWith('*'), `${locale}: certificate remains required`);
      assert.false(labels[2].endsWith('*'), `${locale}: chain remains optional`);
      assert.strictEqual(this.model.get('key'), null, 'rendering never fills a masked private key');
    }
  });

  test('the metadata-preservation explanation exists in every supported locale', async function(assert) {
    for (const locale of ['de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw']) {
      const messages = await (await fetch(`/translations/${locale}.json`)).json();
      assert.ok(messages['editCertificate.noteKeyWriteOnly'], `${locale}: existing hint is translated`);
    }
  });
});
