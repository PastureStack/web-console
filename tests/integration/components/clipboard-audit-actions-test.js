import Service from '@ember/service';
import { run, cancel } from '@ember/runloop';
import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, focus, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import { defer } from 'rsvp';
import { module, test } from 'qunit';
import ApiKeyAudit from 'ui/components/api-key-audit/component';
import auditTemplate from 'ui/components/api-key-audit/template';
import TooltipService from 'ui/services/tooltip';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeLegacyContextPartials } from 'ui/initializers/legacy-context-partials';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

const SUPPORTED_LOCALES = [
  'de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp',
  'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw',
];

function copyComponent(owner, text) {
  return Object.values(owner.lookup('-view-registry:main')).find(view => view.get('clipboardText') === text);
}

function copyTooltip(owner, button) {
  return Object.values(owner.lookup('-view-registry:main')).find(view =>
    view.get('tooltipFor') === 'copyToClipboard' && view.element.contains(button));
}

function resetFeedback(copy) {
  run(() => {
    cancel(copy.get('feedbackTimer'));
    copy.setProperties({status: null, feedbackTimer: null});
  });
}

function useRealTooltip(context) {
  initializeLegacyContextPartials(context.owner);
  context.owner.unregister('service:tooltip');
  context.owner.register('service:tooltip', TooltipService);
  context.owner.register('service:-routing', Service.extend({currentRouteName: 'integration.clipboard'}));
  context.tooltipService = context.owner.lookup('service:tooltip');
  context.set('liveTooltip', context.tooltipService);
}

function nativeMouse(element, type) {
  element.dispatchEvent(new MouseEvent(type, {bubbles: false}));
}

module('Integration | Component | clipboard event and audit actions', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    this.english = await (await fetch('/translations/en-us.json')).json();
    this.intl.addTranslations('en-us', this.english);
    this.intl.setLocale(['en-us']);
    this.owner.register('service:tooltip', Service.extend({requireClick: true, cancelTimer() {}, leave() {}}));
    this.tooltipService = this.owner.lookup('service:tooltip');
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
    if (this.liveTooltip) { cancel(this.liveTooltip.get('mouseLeaveTimer')); }
    await teardownContext(this);
    for (let [target, field, descriptor] of [[navigator, 'clipboard', this.clipboardDescriptor],
      [window, 'isSecureContext', this.secureDescriptor]]) {
      if (descriptor) { Object.defineProperty(target, field, descriptor); } else { delete target[field]; }
    }
    this.testRoot.remove();
  });

  test('actual copy template passes the button event for button and nested icon clicks', async function(assert) {
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="request-copy" buttonText="copyToClipboard.tooltip"}}'));
    const button = find('.copy-button-container button');
    assert.strictEqual(button.textContent.trim(), this.english['copyToClipboard.tooltip'], 'the actual button caption uses a valid translation key');
    assert.notOk(button.textContent.includes('Missing translation'), 'the test fixture renders no missing button caption');
    await click(button);
    await click(button.querySelector('.icon'));
    assert.deepEqual(this.copied, ['request-copy', 'request-copy'], 'both real DOM clicks reach the clipboard');
    const copy = Object.values(this.owner.lookup('-view-registry:main')).find(view => view.get('clipboardText') === 'request-copy');
    assert.strictEqual(copy.get('textChangedEvent')[0], button, 'feedback is anchored to currentTarget, not the nested icon');
  });

  test('initial tooltip and keyboard-style click work without a preceding hover', async function(assert) {
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="keyboard-copy"}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'keyboard-copy');
    const tooltip = copyTooltip(this.owner, button);
    assert.strictEqual(String(tooltip.get('model')), this.english['copyToClipboard.tooltip'],
      'initial render gives the real tooltip a translated message');
    assert.strictEqual(button.title, this.english['copyToClipboard.tooltip'], 'initial native tooltip is translated');
    assert.strictEqual(button.getAttribute('aria-label'), this.english['copyToClipboard.tooltip'], 'initial accessible name is translated');
    assert.strictEqual(copy.get('status'), null, 'copy starts in its idle state');

    await focus(button);
    button.click(); // Native keyboard activation also emits a click without pointer hover.
    await waitUntil(() => copy.get('status') === 'success');
    await waitUntil(() => String(tooltip.get('model')) === this.english['copyToClipboard.copied']);
    assert.deepEqual(this.copied, ['keyboard-copy'], 'focused activation preserves the payload');
    assert.strictEqual(this.tooltipService.get('tooltipOpts.originalNode')[0], button,
      'the keyboard feedback is anchored to the button');
    assert.strictEqual(String(this.tooltipService.get('tooltipOpts.model')), this.english['copyToClipboard.copied'],
      'successful feedback reaches the tooltip service as translated text');
    await settled();
    assert.strictEqual(copy.get('status'), null, 'the success timer resets status');
    assert.strictEqual(String(tooltip.get('model')), this.english['copyToClipboard.tooltip'],
      'the success timer restores a valid default tooltip');
  });

  test('native tooltip hover renders real static initial, copied and failed text and handles pointer departure', async function(assert) {
    useRealTooltip(this);
    const chinese = await (await fetch('/translations/zh-tw.json')).json();
    this.intl.addTranslations('zh-tw', chinese);
    this.intl.setLocale(['zh-tw']);
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="native-hover-copy"}}{{#if this.liveTooltip.tooltipOpts}}{{tooltip-basic class="container-tooltip"}}{{/if}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'native-hover-copy');
    const trigger = copyTooltip(this.owner, button).element;
    assert.notOk(find('.container-tooltip'), 'the shared floating tooltip starts closed');

    nativeMouse(trigger, 'mouseenter');
    await waitUntil(() => find('.container-tooltip'));
    assert.strictEqual(find('.container-tooltip').textContent.trim(), chinese['copyToClipboard.tooltip'],
      'native hover renders the actual tooltip-basic and tooltip-content-static initial message');
    assert.strictEqual(getComputedStyle(find('.container-tooltip')).visibility, 'visible', 'the real floating tooltip is visible');

    button.querySelector('.icon').click();
    await waitUntil(() => find('.container-tooltip').textContent.trim() === chinese['copyToClipboard.copied']);
    assert.deepEqual(this.copied, ['native-hover-copy'], 'the same native control preserves the clipboard payload');
    resetFeedback(copy);
    await settled();
    assert.strictEqual(find('.container-tooltip').textContent.trim(), chinese['copyToClipboard.tooltip'], 'the real static content resets after success');

    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText() {
      return Promise.reject(new Error('Fixture clipboard denied'));
    }}});
    button.click();
    await waitUntil(() => find('.container-tooltip').textContent.trim() === chinese['copyToClipboard.failed']);
    assert.strictEqual(copy.get('status'), 'error', 'failed native copy reports an error through the real tooltip');
    assert.notOk(find('.container-tooltip').textContent.includes('Missing translation'), 'the actual static body has no missing translation');

    nativeMouse(trigger, 'mouseleave');
    assert.ok(this.tooltipService.get('mouseLeaveTimer'), 'leaving the trigger starts the real hide timer');
    nativeMouse(find('.container-tooltip'), 'mouseenter');
    resetFeedback(copy);
    await settled();
    assert.ok(find('.container-tooltip'), 'entering the floating tooltip cancels trigger-departure hiding');
    nativeMouse(find('.container-tooltip'), 'mouseleave');
    await waitUntil(() => !find('.container-tooltip'));
    assert.strictEqual(this.tooltipService.get('tooltipOpts'), null, 'leaving the actual floating content closes the tooltip');
  });

  test('native tooltip destroy removes trigger and floating listeners and detached nodes cannot reopen feedback', async function(assert) {
    useRealTooltip(this);
    this.set('showCopy', true);
    const addDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'addEventListener');
    const removeDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'removeEventListener');
    const originalAdd = Element.prototype.addEventListener;
    const originalRemove = Element.prototype.removeEventListener;
    const added = [], removed = [];
    Object.defineProperty(Element.prototype, 'addEventListener', {configurable: true, value: function(type, listener, ...options) {
      if (type === 'mouseenter' || type === 'mouseleave') { added.push({element: this, type, listener}); }
      return originalAdd.call(this, type, listener, ...options);
    }});
    Object.defineProperty(Element.prototype, 'removeEventListener', {configurable: true, value: function(type, listener, ...options) {
      if (type === 'mouseenter' || type === 'mouseleave') { removed.push({element: this, type, listener}); }
      return originalRemove.call(this, type, listener, ...options);
    }});
    try {
      await render(precompileTemplate('{{#if this.showCopy}}{{copy-to-clipboard clipboardText="native-destroy-copy" tooltipText="複製這段內容"}}{{/if}}{{#if this.liveTooltip.tooltipOpts}}{{tooltip-basic class="container-tooltip"}}{{/if}}'));
      const button = find('.copy-button-container button');
      const trigger = copyTooltip(this.owner, button).element;
      nativeMouse(trigger, 'mouseenter');
      await waitUntil(() => find('.container-tooltip'));
      const floating = find('.container-tooltip');
      assert.strictEqual(floating.textContent.trim(), '複製這段內容', 'the actual static component renders a caller-provided literal');
      const calls = [];
      for (const name of ['cancelTimer', 'startTimer']) {
        const original = this.tooltipService[name];
        this.tooltipService[name] = function(...args) { calls.push(name); return original.apply(this, args); };
      }
      run(() => this.set('showCopy', false));
      await settled();
      assert.notOk(find('.container-tooltip'), 'destroying the active trigger removes its floating tooltip');
      for (const element of [trigger, floating]) {
        for (const type of ['mouseenter', 'mouseleave']) {
          const listeners = added.filter(item => item.element === element && item.type === type);
          assert.strictEqual(listeners.length, 1, `${type} is registered once on the actual ${element === trigger ? 'trigger' : 'floating tooltip'}`);
          assert.ok(listeners.every(item => removed.some(other => other.element === element && other.type === type && other.listener === item.listener)),
            `${type} removes the same native listener on destroy`);
        }
      }
      calls.length = 0;
      for (const element of [trigger, floating]) {
        nativeMouse(element, 'mouseenter');
        nativeMouse(element, 'mouseleave');
      }
      await settled();
      assert.deepEqual(calls, [], 'detached trigger and floating nodes no longer reach the tooltip service');
      assert.strictEqual(this.tooltipService.get('tooltipOpts'), null, 'detached hover cannot recreate tooltip feedback');
    } finally {
      if (addDescriptor) { Object.defineProperty(Element.prototype, 'addEventListener', addDescriptor); } else { delete Element.prototype.addEventListener; }
      if (removeDescriptor) { Object.defineProperty(Element.prototype, 'removeEventListener', removeDescriptor); } else { delete Element.prototype.removeEventListener; }
    }
  });

  test('native tooltip action-menu hover preserves its override and keeps open actions visible', async function(assert) {
    useRealTooltip(this);
    this.owner.register('service:resource-actions', Service.extend({open: false}));
    const resourceActions = this.owner.lookup('service:resource-actions');
    await render(precompileTemplate('{{#tooltip-element type="tooltip-action-menu" model="Action menu hover fixture" tooltipTemplate="tooltip-static" tooltipFor="fixture-action-menu"}}<button type="button">Menu</button>{{/tooltip-element}}{{#if this.liveTooltip.tooltipOpts}}{{tooltip-action-menu tooltipTemplate="tooltip-static" class="container-tooltip"}}{{/if}}'));
    const trigger = Object.values(this.owner.lookup('-view-registry:main')).find(view => view.get('tooltipFor') === 'fixture-action-menu').element;
    nativeMouse(trigger, 'mouseenter');
    await waitUntil(() => find('.container-tooltip'));
    const floating = find('.container-tooltip');
    const menu = Object.values(this.owner.lookup('-view-registry:main')).find(view => view.element === floating);
    assert.strictEqual(floating.textContent.trim(), 'Action menu hover fixture', 'the real action-menu subclass renders through its shared static content');

    nativeMouse(floating, 'mouseenter');
    assert.true(menu.get('inTooltip'), 'native enter reaches the action-menu override through virtual dispatch');
    run(() => resourceActions.set('open', true));
    await settled();
    assert.true(menu.get('actionsOpen'), 'the real action-menu alias observes the open action state');
    nativeMouse(floating, 'mouseleave');
    await settled();
    assert.false(menu.get('inTooltip'), 'native leave reaches the action-menu override');
    assert.strictEqual(find('.container-tooltip'), floating, 'open actions remain visible instead of running the mixin default hide timer');
    assert.ok(this.tooltipService.get('tooltipOpts'), 'open actions retain their tooltip ownership');

    run(() => resourceActions.set('open', false));
    await waitUntil(() => !find('.container-tooltip'));
    assert.strictEqual(this.tooltipService.get('tooltipOpts'), null, 'closing actions after pointer departure releases the tooltip normally');
  });

  test('all 13 shipped YAML locales provide initial, copied, failed and reset tooltip messages', async function(assert) {
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="localized-copy"}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'localized-copy');
    const tooltip = copyTooltip(this.owner, button);

    for (const locale of SUPPORTED_LOCALES) {
      // These assets are built directly from translations/*.yaml by TranslationJsonTree.
      const response = await fetch(`/translations/${locale}.json`);
      assert.true(response.ok, `${locale}: the actual translation asset exists`);
      const messages = await response.json();
      for (const key of ['tooltip', 'copied', 'failed']) {
        assert.ok(typeof messages[`copyToClipboard.${key}`] === 'string' && messages[`copyToClipboard.${key}`].trim(),
          `${locale}: the shipped YAML contains ${key}`);
      }
      this.intl.addTranslations(locale, messages);
      this.intl.setLocale([locale]); // No English fallback can hide a missing locale message.
      await settled();
      assert.strictEqual(String(tooltip.get('model')), messages['copyToClipboard.tooltip'], `${locale}: initial tooltip`);

      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: text => {
        this.copied.push(text);
        return Promise.resolve();
      }}});
      const copied = run(() => copy.actions.copy.call(copy, {currentTarget: button}));
      assert.ok(copied && typeof copied.then === 'function', `${locale}: copy returns an awaitable Promise`);
      await copied;
      await waitUntil(() => String(tooltip.get('model')) === messages['copyToClipboard.copied']);
      assert.strictEqual(copy.get('status'), 'success', `${locale}: copied status`);
      assert.strictEqual(String(this.tooltipService.get('tooltipOpts.model')), messages['copyToClipboard.copied'],
        `${locale}: copied tooltip`);
      resetFeedback(copy);
      await settled();
      assert.strictEqual(copy.get('status'), null, `${locale}: copied status resets`);
      assert.strictEqual(String(tooltip.get('model')), messages['copyToClipboard.tooltip'], `${locale}: copied tooltip resets`);

      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText() {
        return Promise.reject(new Error('Fixture clipboard denied'));
      }}});
      const failed = run(() => copy.actions.copy.call(copy, {currentTarget: button}));
      assert.ok(failed && typeof failed.then === 'function', `${locale}: failed copy remains awaitable`);
      await failed;
      await waitUntil(() => String(tooltip.get('model')) === messages['copyToClipboard.failed']);
      assert.notStrictEqual(copy.get('status'), 'success', `${locale}: failure never reports success`);
      assert.strictEqual(String(this.tooltipService.get('tooltipOpts.model')), messages['copyToClipboard.failed'],
        `${locale}: failure tooltip`);
      resetFeedback(copy);
      await settled();
      assert.strictEqual(copy.get('status'), null, `${locale}: failed status resets`);
      assert.strictEqual(String(tooltip.get('model')), messages['copyToClipboard.tooltip'], `${locale}: failed tooltip resets`);
    }
    assert.deepEqual(this.copied, SUPPORTED_LOCALES.map(() => 'localized-copy'), 'every locale preserves the exact clipboard payload');
  });

  test('custom translated tooltip text is literal and survives successful and failed copy resets', async function(assert) {
    this.set('literal', '複製這一段 {literal}');
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="custom-copy" tooltipText=this.literal}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'custom-copy');
    const tooltip = copyTooltip(this.owner, button);
    assert.strictEqual(String(tooltip.get('model')), this.literal, 'custom text is displayed without a second translation lookup');

    for (const succeeds of [true, false]) {
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText() {
        return succeeds ? Promise.resolve() : Promise.reject(new Error('Fixture clipboard denied'));
      }}});
      await run(() => copy.actions.copy.call(copy, {currentTarget: button}));
      const key = succeeds ? 'copyToClipboard.copied' : 'copyToClipboard.failed';
      await waitUntil(() => String(tooltip.get('model')) === this.english[key]);
      assert.strictEqual(String(this.tooltipService.get('tooltipOpts.model')), this.english[key],
        `${succeeds ? 'success' : 'failure'} uses its localized feedback`);
      resetFeedback(copy);
      await settled();
      assert.strictEqual(String(tooltip.get('model')), this.literal, 'reset restores the custom literal');
    }
  });

  test('writeText rejection and synchronous throw are handled by the real click action', async function(assert) {
    await render(precompileTemplate('{{copy-to-clipboard clipboardText="denied-copy"}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'denied-copy');
    const tooltip = copyTooltip(this.owner, button);
    const unhandled = [];
    const onUnhandled = event => unhandled.push(event.reason);
    window.addEventListener('unhandledrejection', onUnhandled);
    try {
      for (const synchronous of [false, true]) {
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText() {
          const error = new Error('Fixture clipboard denied');
          if (synchronous) { throw error; }
          return Promise.reject(error);
        }}});
        button.querySelector('.icon').click();
        await waitUntil(() => String(tooltip.get('model')) === this.english['copyToClipboard.failed']);
        assert.notStrictEqual(copy.get('status'), 'success', `${synchronous ? 'throw' : 'rejection'} does not show success`);
        assert.strictEqual(this.tooltipService.get('tooltipOpts.originalNode')[0], button,
          'failure feedback remains anchored to currentTarget');
        if (!synchronous) { resetFeedback(copy); }
        await settled();
        assert.strictEqual(String(tooltip.get('model')), this.english['copyToClipboard.tooltip'], 'failed feedback resets');
      }
      assert.deepEqual(unhandled, [], 'no unhandled rejection reaches the browser');
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
    }
  });

  test('multiple copy controls keep their own literals, locale updates and active feedback', async function(assert) {
    const chinese = await (await fetch('/translations/zh-tw.json')).json();
    this.intl.addTranslations('zh-tw', chinese);
    this.set('literal', '複製指定內容');
    this.set('showDefault', true);
    await render(precompileTemplate('<div data-literal>{{copy-to-clipboard clipboardText="literal-sibling" tooltipText=this.literal}}</div>{{#if this.showDefault}}<div data-default>{{copy-to-clipboard clipboardText="default-sibling"}}</div>{{/if}}'));
    const literalButton = find('[data-literal] button');
    const defaultButton = find('[data-default] button');
    const literalCopy = copyComponent(this.owner, 'literal-sibling');
    const defaultCopy = copyComponent(this.owner, 'default-sibling');
    assert.strictEqual(literalButton.title, this.literal, 'the first control owns its translated literal');
    assert.strictEqual(defaultButton.title, this.english['copyToClipboard.tooltip'], 'its sibling owns the default message');

    await run(() => defaultCopy.actions.copy.call(defaultCopy, {currentTarget: defaultButton}));
    await waitUntil(() => this.tooltipService.get('tooltipOpts.model') === this.english['copyToClipboard.copied']);
    run(() => this.set('literal', '另一個複製提示'));
    await waitUntil(() => literalButton.title === this.literal);
    assert.strictEqual(this.tooltipService.get('tooltipOpts.originalNode')[0], defaultButton, 'an inactive literal change preserves the active trigger');
    assert.strictEqual(this.tooltipService.get('tooltipOpts.model'), this.english['copyToClipboard.copied'], 'an inactive literal cannot overwrite copied feedback');

    await run(() => literalCopy.actions.copy.call(literalCopy, {currentTarget: literalButton}));
    await waitUntil(() => this.tooltipService.get('tooltipOpts.originalNode')[0] === literalButton);
    resetFeedback(defaultCopy);
    await waitUntil(() => defaultButton.title === this.english['copyToClipboard.tooltip']);
    assert.strictEqual(this.tooltipService.get('tooltipOpts.model'), this.english['copyToClipboard.copied'], 'the previous control resetting cannot overwrite the new active feedback');

    run(() => this.intl.setLocale(['zh-tw']));
    await waitUntil(() => defaultButton.title === chinese['copyToClipboard.tooltip'] && literalButton.title === chinese['copyToClipboard.copied']);
    assert.strictEqual(this.tooltipService.get('tooltipOpts.originalNode')[0], literalButton, 'locale switching preserves tooltip ownership');
    assert.strictEqual(this.tooltipService.get('tooltipOpts.model'), chinese['copyToClipboard.copied'], 'the idle sibling cannot overwrite localized active success');
    run(() => this.set('showDefault', false));
    await waitUntil(() => !find('[data-default] button'));
    assert.strictEqual(this.tooltipService.get('tooltipOpts.originalNode')[0], literalButton, 'destroying an inactive sibling keeps the active tooltip');
    await settled();
    assert.strictEqual(literalButton.title, this.literal, 'active success resets to that control’s literal');
    assert.strictEqual(this.tooltipService.get('tooltipOpts.model'), this.literal, 'the active tooltip resets to its own literal');
    assert.deepEqual(this.copied, ['default-sibling', 'literal-sibling'], 'each button keeps its own payload');
  });

  test('destroy cancels feedback timers and pending clipboard completion cannot update a destroyed component', async function(assert) {
    this.set('showCopy', true);
    await render(precompileTemplate('{{#if this.showCopy}}{{copy-to-clipboard clipboardText="destroy-copy"}}{{/if}}'));
    const button = find('.copy-button-container button');
    const copy = copyComponent(this.owner, 'destroy-copy');
    await run(() => copy.actions.copy.call(copy, {currentTarget: button}));
    await waitUntil(() => copy.get('status') === 'success');
    const originalSet = copy.set;
    const changes = [];
    copy.set = function(...args) {
      if (this.isDestroying || this.isDestroyed) { changes.push(args[0]); }
      return originalSet.apply(this, args);
    };
    run(() => this.set('showCopy', false));
    await settled();
    assert.true(copy.isDestroyed, 'the rendered copy component was destroyed');
    assert.deepEqual(changes, [], 'the feedback timer does not set properties after destruction');
    assert.strictEqual(this.tooltipService.get('tooltipOpts'), null, 'destroying the active copy also removes its stale tooltip');

    for (const succeeds of [true, false]) {
      const pending = defer();
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText() { return pending.promise; }}});
      run(() => this.set('showCopy', true));
      await settled();
      const pendingCopy = copyComponent(this.owner, 'destroy-copy');
      const pendingButton = find('.copy-button-container button');
      const completed = run(() => pendingCopy.actions.copy.call(pendingCopy, {currentTarget: pendingButton}));
      assert.ok(completed && typeof completed.then === 'function', 'pending operation can be awaited');
      const pendingSet = pendingCopy.set;
      pendingCopy.set = function(...args) {
        if (this.isDestroying || this.isDestroyed) { changes.push(args[0]); }
        return pendingSet.apply(this, args);
      };
      run(() => this.set('showCopy', false));
      await settled();
      run(() => succeeds ? pending.resolve() : pending.reject(new Error('Fixture clipboard denied')));
      await completed;
      await settled();
      assert.true(pendingCopy.isDestroyed, 'pending copy was destroyed before clipboard completion');
      assert.deepEqual(changes, [], `${succeeds ? 'resolved' : 'rejected'} completion does not update the destroyed component`);
    }
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
