import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import FailWhaleTemplate from 'ui/fail-whale/template';
import resolver from '../../helpers/resolver';

module('Integration | Route | fail whale localized error', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      let messages = await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, messages);
    }
    this.settings = {isRancher: false};
    this.actions = {logout() {}};
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('a denied environment error follows English and Traditional Chinese locale changes', async function(assert) {
    this.intl.setLocale(['en-us']);
    this.model = {
      status: 404,
      message: 'This environment does not exist or you do not have permission to view it. Refresh the page or contact an administrator.',
      messageKey: 'viewEditProject.error.projectUnavailable',
    };

    await render(FailWhaleTemplate);
    assert.strictEqual(find('.fail-whale h2').textContent.trim(), 'Error');
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), this.model.message);

    this.intl.setLocale(['zh-tw', 'en-us']);
    await settled();
    assert.strictEqual(find('.fail-whale h2').textContent.trim(), '錯誤');
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(),
      '找不到此環境，或您沒有權限檢視。請重新整理或聯絡管理員。',
      'the already-visible failure body changes with the locale');
  });

  test('untranslated errors retain their original message', async function(assert) {
    this.intl.setLocale(['zh-tw', 'en-us']);
    this.model = {status: 500, message: 'Unexpected failure'};
    await render(FailWhaleTemplate);
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), 'Unexpected failure');
  });

  test('a missing or denied template edit shows a human message in both locales', async function(assert) {
    this.intl.setLocale(['en-us']);
    this.model = {
      status: 404,
      messageKey: 'resourceLoadError.projectTemplateUnavailable',
    };

    await render(FailWhaleTemplate);
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(),
      'This environment template does not exist or you do not have permission to edit it. Refresh the page or contact an administrator.');

    this.intl.setLocale(['zh-tw', 'en-us']);
    await settled();
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(),
      '找不到此環境範本，或您沒有權限編輯。請重新整理或聯絡管理員。');
  });
});
