import EmberObject from '@ember/object';
import Service from '@ember/service';
import Component, { setComponentTemplate } from '@ember/component';
import { run, cancel } from '@ember/runloop';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import { module, test } from 'qunit';
import HostsNewController from 'ui/hosts/new/controller';
import HostsNewRoute from 'ui/hosts/new/route';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

module('Integration | Component | host registration copy and close', function(hooks) {
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
    this.project = EmberObject.create({isWindows: false});
    this.owner.register('service:projects', Service.extend({current: this.project}));
    this.owner.register('service:settings', Service.extend({appName: 'Fixture', docsBase: 'https://docs.invalid'}));
    this.owner.register('service:tooltip', Service.extend({requireClick: true, cancelTimer() {}, leave() {}}));
    this.owner.register('service:store', Service.extend({find() { throw new Error('Registration fixture must not request a token'); }}));
    const Labels = Component.extend({tagName: 'div'});
    setComponentTemplate(precompileTemplate(''), Labels);
    this.owner.register('component:form-user-labels', Labels);
    // The unrelated Hosts hyperlink is outside this rendering test's routing
    // lifecycle. Keep copy/Close real without rebuilding the global route DSL.
    const Link = Component.extend({tagName: 'a'});
    setComponentTemplate(precompileTemplate('{{yield}}'), Link);
    this.owner.register('component:link-to', Link);
    this.copied = [];
    this.clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    this.secureDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: text => { this.copied.push(text); return Promise.resolve(); },
    }});
    Object.defineProperty(window, 'isSecureContext', {configurable: true, value: true});
    this.token = EmberObject.create({command: 'docker run --name fixture-agent fixture-image',
      registrationUrl: 'http://127.0.0.1:0/fixture', windowsCommand: 'Write-Output fixture-agent'});
    this.routeActions = [];
    this.transitions = [];
    const routeActions = this.routeActions, transitions = this.transitions;
    this.route = HostsNewRoute.create({backTo: 'waiting', router: {
      transitionTo(...args) { transitions.push(args); },
    }, send(name, ...args) {
      routeActions.push(name);
      return this.actions[name].apply(this, args);
    }});
    const route = this.route;
    this.controller = HostsNewController.create({target: {send(name, ...args) { return route.send(name, ...args); }}});
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    run(() => { this.controller.destroy(); this.route.destroy(); this.project.destroy(); this.token.destroy(); });
    for (const [target, field, descriptor] of [[navigator, 'clipboard', this.clipboardDescriptor],
      [window, 'isSecureContext', this.secureDescriptor]]) {
      if (descriptor) { Object.defineProperty(target, field, descriptor); } else { delete target[field]; }
    }
    this.testRoot.remove();
  });

  for (const windows of [false, true]) {
    test(`${windows ? 'Windows' : 'Linux'} displayed registration command copies and Close reaches the existing route`, async function(assert) {
      run(() => this.project.set('isWindows', windows));
      await render(precompileTemplate('{{machine/driver-custom clonedModel=this.token cancel=(action "cancel" target=this.controller) goBack=(action "goBack" target=this.controller)}}'));
      const command = find('#registration-command');
      const button = command.parentElement.querySelector('.copy-button-container button');
      assert.strictEqual(button.title, this.english['copyToClipboard.tooltip'], 'registration initially has a translated tooltip without hover');
      assert.strictEqual(button.getAttribute('aria-label'), this.english['copyToClipboard.tooltip'], 'keyboard activation has a translated accessible name');
      await click(button);
      await click(button.querySelector('.icon'));
      assert.deepEqual(this.copied, [command.textContent, command.textContent],
        'both real clicks copy exactly the displayed command, including Windows newlines');
      await click(find('.footer-actions button'));
      assert.deepEqual(this.routeActions, ['cancel', 'goBack'], 'the closure explicitly reaches the native cancel/goBack lifecycle');
      assert.deepEqual(this.transitions, [['authenticated.project.waiting']], 'Close returns to the existing waiting destination');
    });
  }

  test('goBack closure uses the same route dispatch as other machine drivers', async function(assert) {
    await render(precompileTemplate('<button type="button" data-driver-back onclick={{action "goBack" target=this.controller}}>Back</button>'));
    await click(find('[data-driver-back]'));
    assert.deepEqual(this.routeActions, ['goBack']);
    assert.deepEqual(this.transitions, [['authenticated.project.waiting']]);
  });

  test('HTTP clipboard fallback copies the displayed registration command and removes its textarea', async function(assert) {
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
    Object.defineProperty(window, 'isSecureContext', {configurable: true, value: false});
    const descriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {configurable: true, value: name => {
      assert.strictEqual(name, 'copy');
      this.copied.push(document.activeElement.value);
      return true;
    }});
    try {
      await render(precompileTemplate('{{machine/driver-custom clonedModel=this.token cancel=(action "cancel" target=this.controller)}}'));
      const command = find('#registration-command');
      const count = document.querySelectorAll('textarea').length;
      await click(command.parentElement.querySelector('.copy-button-container button .icon'));
      assert.deepEqual(this.copied, [command.textContent], 'HTTP fallback preserves the complete command');
      assert.strictEqual(document.querySelectorAll('textarea').length, count, 'the temporary clipboard element is removed');
    } finally {
      if (descriptor) { Object.defineProperty(document, 'execCommand', descriptor); } else { delete document.execCommand; }
    }
  });

  test('HTTP clipboard fallback removes its textarea and reports localized failure when execCommand fails or throws', async function(assert) {
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
    Object.defineProperty(window, 'isSecureContext', {configurable: true, value: false});
    const messages = await (await fetch('/translations/zh-tw.json')).json();
    this.intl.addTranslations('zh-tw', messages);
    this.intl.setLocale(['zh-tw']);
    const descriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    try {
      await render(precompileTemplate('{{machine/driver-custom clonedModel=this.token cancel=(action "cancel" target=this.controller)}}'));
      const command = find('#registration-command');
      const button = command.parentElement.querySelector('.copy-button-container button');
      const copy = Object.values(this.owner.lookup('-view-registry:main')).find(view => view.get('clipboardText') === command.textContent);
      const count = document.querySelectorAll('textarea').length;
      assert.strictEqual(button.title, messages['copyToClipboard.tooltip'], 'HTTP registration initially has its localized tooltip');
      for (const throws of [false, true]) {
        Object.defineProperty(document, 'execCommand', {configurable: true, value: name => {
          assert.strictEqual(name, 'copy');
          assert.strictEqual(document.activeElement.value, command.textContent, 'fallback preserves the displayed command before failing');
          if (throws) { throw new Error('Fixture execCommand failed'); }
          return false;
        }});
        button.querySelector('.icon').click();
        await waitUntil(() => copy.get('status') === 'error');
        await waitUntil(() => button.title === messages['copyToClipboard.failed']);
        assert.strictEqual(document.querySelectorAll('textarea').length, count,
          `${throws ? 'throw' : 'false result'} removes the temporary clipboard element`);
        assert.strictEqual(button.getAttribute('aria-label'), messages['copyToClipboard.failed'], 'failed copy provides localized accessible feedback');
        assert.strictEqual(copy.get('textChangedEvent')[0], button, 'failure feedback is anchored to currentTarget');
        assert.true(button.classList.contains('btn-danger'), 'failed copy uses the error button state');
        assert.false(button.classList.contains('btn-success'), 'failed copy never shows the successful state');
        run(() => {
          cancel(copy.get('feedbackTimer'));
          copy.setProperties({status: null, feedbackTimer: null});
        });
        await settled();
      }
    } finally {
      if (descriptor) { Object.defineProperty(document, 'execCommand', descriptor); } else { delete document.execCommand; }
    }
  });
});
