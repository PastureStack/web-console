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
    this.model = {status: 500, title: 'Unexpected error', message: 'Unexpected failure'};
    await render(FailWhaleTemplate);
    assert.strictEqual(find('.fail-whale h4').textContent.trim(), 'Unexpected error (500)');
    assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), 'Unexpected failure');
  });

  [
    ['add container', 'containersPage.index.linkTo', 'containersPage.permissionDenied',
      'Add Container', 'You do not have permission to add containers in this environment.',
      '新增容器', '您沒有權限在此環境中新增容器。'],
    ['add host', 'hostsPage.new.header.text', 'hostsPage.permissionDenied',
      'Add Host', 'You do not have permission to add hosts in this environment.',
      '新增主機', '您沒有權限在此環境中新增主機。'],
    ['add receiver', 'hookPage.receiver.buttonText', 'hookPage.receiver.permissionDenied',
      'Add Receiver', 'You do not have permission to add receiver hooks in this environment.',
      '新增接收器', '您沒有權限在此環境中新增接收端 Webhook。'],
    ['add secret', 'secretsPage.index.linkTo', 'secretsPage.permissionDenied',
      'Add Secret', 'You do not have permission to add secrets in this environment.',
      '新增機密資料', '您沒有權限在此環境中新增機密資料。'],
    ['add certificate', 'certificatesPage.index.linkTo', 'certificatesPage.permissionDenied',
      'Add Certificate', 'You do not have permission to add certificates in this environment.',
      '新增憑證', '您沒有權限在此環境中新增憑證。'],
    ['add registry', 'registriesPage.index.linkTo', 'registriesPage.permissionDenied',
      'Add Registry', 'You do not have permission to add registries in this environment.',
      '新增映像庫', '您沒有權限在此環境中新增映像庫。'],
    ['edit receiver', 'newReceiver.title.edit', 'hookPage.receiver.editPermissionDenied',
      'Edit Receiver', 'Editing receiver hooks is not available in this environment.',
      '編輯接收器', '此環境不提供編輯接收端 Webhook 的功能。'],
  ].forEach(([label, titleKey, messageKey, englishTitle, englishMessage, chineseTitle, chineseMessage]) => {
    test(`${label} denial re-translates on the same error page`, async function(assert) {
      this.intl.setLocale(['en-us']);
      this.model = {status: 403, title: englishTitle, titleKey, message: englishMessage, messageKey};
      await render(FailWhaleTemplate);
      assert.strictEqual(find('.fail-whale h4').textContent.trim(), `${englishTitle} (403)`);
      assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), englishMessage);

      this.intl.setLocale(['zh-tw', 'en-us']);
      await settled();
      assert.strictEqual(find('.fail-whale h4').textContent.trim(), `${chineseTitle} (403)`);
      assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), chineseMessage);
    });
  });

  [
    ['secret', 'secretsPage', 'この環境にシークレットを追加する権限がありません。',
      'You do not have permission to add secrets in this environment.'],
    ['certificate', 'certificatesPage', 'この環境に証明書を追加する権限がありません。',
      'You do not have permission to add certificates in this environment.'],
    ['registry', 'registriesPage', 'この環境にレジストリを追加する権限がありません。',
      'You do not have permission to add registries in this environment.'],
  ].forEach(([label, page, japaneseMessage, englishMessage]) => {
    test(`${label} denial uses Japanese copy and an English fallback in other locales`, async function(assert) {
      for (let locale of ['ja-jp', 'de-de']) {
        let messages = await (await fetch(`/translations/${locale}.json`)).json();
        this.intl.addTranslations(locale, messages);
      }
      this.intl.setLocale(['ja-jp', 'en-us']);
      this.model = {
        status: 403,
        titleKey: `${page}.index.linkTo`,
        messageKey: `${page}.permissionDenied`,
      };
      await render(FailWhaleTemplate);
      assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), japaneseMessage);

      this.intl.setLocale(['de-de', 'en-us']);
      await settled();
      assert.strictEqual(find('.fail-whale .r-p20 > p').textContent.trim(), englishMessage);
      assert.notOk(find('.fail-whale').textContent.includes('Missing translation'));
    });
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
