import Service from '@ember/service';
import { run, cancel } from '@ember/runloop';
import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import { defer } from 'rsvp';
import { module, test } from 'qunit';
import ApiKeyAudit from 'ui/components/api-key-audit/component';
import auditTemplate from 'ui/components/api-key-audit/template';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

module('Integration | Component | clipboard event and audit actions', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    this.intl.addTranslations('en-us', await (await fetch('/translations/en-us.json')).json());
    this.intl.setLocale(['en-us']);
    this.owner.register('service:tooltip', Service.extend({requireClick: true, cancelTimer() {}, leave() {}}));
    this.owner.register('service:access', Service.extend({identity: {id: 'test-viewer'}}));
    this.owner.register('service:endpoint', Service.extend({absolute: '/'}));
    this.copied = [];
    this.clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    this.secureDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: (text) => { this.copied.push(text); return Promise.resolve(); },
    }});
    Object.defineProperty(window, 'isSecureContext', {configurable: true, value: true});
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    if (this.audit) { cancel(this.audit._timer); }
    await teardownContext(this);
    for (let [target, field, descriptor] of [[navigator, 'clipboard', this.clipboardDescriptor],
      [window, 'isSecureContext', this.secureDescriptor]]) {
      if (descriptor) { Object.defineProperty(target, field, descriptor); } else { delete target[field]; }
    }
    this.testRoot.remove();
  });

  test('actual copy template passes the button event for button and nested icon clicks', async function(assert) {
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="request-copy" buttonText="Copy"}}'));
    const button = find('.copy-button-container button');
    await click(button);
    await click(button.querySelector('.icon'));
    assert.deepEqual(this.copied, ['request-copy', 'request-copy'], 'both real DOM clicks reach the clipboard');
    const copy = Object.values(this.owner.lookup('-view-registry:main')).find(view => view.get('clipboardText') === 'request-copy');
    assert.strictEqual(copy.get('textChangedEvent')[0], button, 'feedback is anchored to currentTarget, not the nested icon');
  });

  test('audit copy and actual last-column details button stay distinct with a real rendered row', async function(assert) {
    const context = this;
    const requests = [];
    const pending = defer();
    this.owner.register('service:user-store', Service.extend({rawRequest(options) { requests.push(options); return pending.promise; }}));
    const CapturedAudit = ApiKeyAudit.extend({didInsertElement() { this._super(...arguments); context.audit = this; }});
    setComponentTemplate(auditTemplate, CapturedAudit);
    this.owner.register('component:api-key-audit', CapturedAudit);
    await render(precompileTemplate('{{api-key-audit}}'));
    const record = {id: '1al42', keyId: '1c42', requestId: 'request-audit', targetType: 'apiKey',
      targetId: '1c42', operation: 'read', phase: 'response', outcome: 'SUCCEEDED', decision: 'ALLOW', httpStatus: 200};
    run(() => this.audit.setProperties({keyId: '1c42', rows: [this.audit.safeRecord(record)], total: 1}));
    await settled();
    const firstButton = find('.api-key-audit tbody button');
    const details = find('.api-key-audit tbody tr > td:last-child > button');
    assert.ok(firstButton.closest('.copy-button-container'), 'the first button is a copy action, not details');
    assert.notStrictEqual(firstButton, details, 'the precise selector avoids the copy button');
    assert.strictEqual(details.textContent.trim(), String(this.intl.t('apiKeyAudit.details')));
    await click(firstButton);
    assert.deepEqual(this.copied, ['request-audit'], 'copy remains functional in its real audit caller');
    assert.strictEqual(requests.length, 0, 'copy never requests audit details');
    details.click();
    await waitUntil(() => requests.length === 1);
    assert.strictEqual(requests[0].method, 'GET');
    assert.strictEqual(requests[0].url, '/v2-beta/pasturestack/key-audit-logs/1al42?keyId=1c42');
    pending.resolve({body: record});
    await waitUntil(() => this.audit.get('detail.id') === '1al42');
    cancel(this.audit._timer);
    await settled();
    assert.ok(find('.api-key-audit h3'), 'the real details click renders its returned record');
    assert.deepEqual(this.copied, ['request-audit'], 'details did not trigger another clipboard write');
  });
});
