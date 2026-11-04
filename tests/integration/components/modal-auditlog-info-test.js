import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, findAll, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

const LOCALES = ['de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw'];

module('Integration | Component | audit payload display', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    let context = this;
    this.closed = 0;
    this.owner.register('service:modal', Service.extend({
      modalVisible: true,
      modalOpts: {requestObject: undefined, responseObject: null},
      toggleModal() { context.closed++; },
    }));
    this.modal = this.owner.lookup('service:modal');
    await setupRenderingContext(this);
  });
  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  test('all thirteen locales render explicit empty and unavailable states without blocking close', async function(assert) {
    let messages = {};
    for ( let locale of LOCALES ) {
      messages[locale] = await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, messages[locale]);
    }
    this.intl.setLocale(['en-us']);
    await render(precompileTemplate('{{modal-auditlog-info modalService=this.modal}}'));
    for ( let locale of LOCALES ) {
      this.intl.setLocale([locale, 'en-us']);
      this.modal.set('modalOpts', {requestObject: undefined, responseObject: null});
      await settled();
      assert.strictEqual(findAll('.modal-container h3').length, 2);
      assert.strictEqual(find('.modal-container h2').textContent.trim(), messages[locale]['modalAuditlogInfo.header']);
      assert.deepEqual(findAll('.modal-container h3').map(node => node.textContent.trim()),
        [messages[locale]['modalAuditlogInfo.request'], messages[locale]['modalAuditlogInfo.response']]);
      assert.deepEqual(findAll('.modal-container .text-muted').map(node => node.textContent.trim()),
        [messages[locale]['modalAuditlogInfo.noContent'], messages[locale]['modalAuditlogInfo.noContent']], locale);
      let circular = {}; circular.self = circular;
      this.modal.set('modalOpts', {requestObject: circular, responseObject: null});
      await settled();
      assert.strictEqual(find('.modal-container .text-muted').textContent.trim(), messages[locale]['modalAuditlogInfo.unavailable'], locale);
      assert.false(find('.modal-container').textContent.includes('Missing translation'));
    }
    await click('.modal-container .footer-actions button');
    assert.strictEqual(this.closed, 1, 'the existing dismiss action still closes once');
  });

  test('plain text is escaped, valid JSON remains visible and opening another record replaces prior content', async function(assert) {
    let messages = await (await fetch('/translations/en-us.json')).json();
    this.intl.addTranslations('en-us', messages);
    this.intl.setLocale(['en-us']);
    let untrusted = '</pre><img src=x onerror="window.auditPayloadExecuted=true"><script>window.auditPayloadExecuted=true</script>';
    this.modal.set('modalOpts', {requestObject: untrusted, responseObject: '{"status":200}'});
    await render(precompileTemplate('{{modal-auditlog-info modalService=this.modal}}'));
    assert.strictEqual(find('[data-testid="audit-request-plain-text"]').textContent, untrusted);
    assert.strictEqual(findAll('.modal-container script, .modal-container img').length, 0);
    assert.strictEqual(window.auditPayloadExecuted, undefined);
    assert.true(find('.modal-container code').textContent.includes('200'));
    this.modal.set('modalOpts', {requestObject: undefined, responseObject: [false, 0]});
    await settled();
    assert.strictEqual(find('[data-testid="audit-request-plain-text"]'), null);
    assert.deepEqual(JSON.parse(find('.modal-container code').textContent), [false, 0]);
  });
});
