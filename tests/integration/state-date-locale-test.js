import { module, test } from 'qunit';
import { render, find, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import resolver from '../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';

module('Integration | Locale | state and relative date', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');

    // Read the build's real translation JSON rather than replacing the intl service.
    for (let locale of ['en-us', 'zh-tw']) {
      let response = await fetch(`/translations/${locale}.json`);
      if (!response.ok) {
        throw new Error(`Local translation fixture failed: ${locale} ${response.status}`);
      }
      this.intl.addTranslations(locale, await response.json());
    }
    this.intl.setLocale(['en-us']);
    this.previousMomentLocale = moment.locale();
    this.previousMomentNow = moment.now;
    moment.locale('en');
    moment.now = () => Date.UTC(2026, 9, 1, 12);
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    moment.now = this.previousMomentNow;
    moment.locale(this.previousMomentLocale);
    this.testRoot.remove();
  });

  test('relative date rerenders en to zh-tw to en without changing the date or global Moment locale', async function(assert) {
    this.created = Date.UTC(2026, 9, 1, 8);
    await render(precompileTemplate('<span class="relative-date">{{date-from-now this.created}}</span>'));
    assert.strictEqual(find('.relative-date').textContent, '4 hours ago');

    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.strictEqual(find('.relative-date').textContent, '4 小時前', 'the unchanged timestamp is recomputed in Traditional Chinese');
    assert.strictEqual(moment.locale(), 'en', 'the helper uses an instance locale');

    run(() => this.intl.setLocale(['en-us']));
    await settled();
    assert.strictEqual(find('.relative-date').textContent, '4 hours ago', 'switching back does not leave a stale Chinese result');
  });

  test('relative date follows the existing zh-hans and English locale mapping', async function(assert) {
    this.created = Date.UTC(2026, 9, 1, 8);
    run(() => this.intl.setLocale(['zh-hans', 'en-us']));
    await render(precompileTemplate('<span class="relative-date">{{date-from-now this.created}}</span>'));
    assert.strictEqual(find('.relative-date').textContent, '4 小时前');
    assert.strictEqual(moment.locale(), 'en', 'the mapped locale remains instance-local');
  });

  test('all eight known resource states use the existing translations and rerender on locale change', async function(assert) {
    this.models = [
      ['active', 'Active', '使用中'],
      ['inactive', 'Inactive', '未啟用'],
      ['running', 'Running', '執行中'],
      ['stopped', 'Stopped', '已停止'],
      ['stopping', 'Stopping', '停止中'],
      ['created', 'Created', '已建立'],
      ['exited', 'Exited', '已結束'],
      ['error', 'Error', '發生錯誤'],
    ].map(([state, displayState, chinese]) => EmberObject.create({state, displayState, chinese}));
    await render(precompileTemplate('{{#each this.models as |model|}}{{badge-state model=model}}{{/each}}'));

    let labels = () => [...this.testRoot.querySelectorAll('.badge')].map((badge) => badge.textContent.trim());
    assert.deepEqual(labels(), this.models.map((model) => model.displayState));
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.deepEqual(labels(), this.models.map((model) => model.chinese));
    run(() => this.intl.setLocale(['en-us']));
    await settled();
    assert.deepEqual(labels(), this.models.map((model) => model.displayState));
  });

  test('inactive uses a resource-state translation in every supported locale', async function(assert) {
    this.model = EmberObject.create({state: 'inactive', displayState: 'Inactive'});
    await render(precompileTemplate('{{badge-state model=this.model}}'));

    for (let [locale, expected] of [
      ['de-de', 'Inaktiv'], ['en-us', 'Inactive'], ['fa-ir', 'غیر فعال'],
      ['fil-ph', 'Hindi aktibo'], ['fr-fr', 'Inactif'], ['hu-hu', 'Inaktív'],
      ['ja-jp', '休止'], ['ko-kr', '비활성'], ['pt-br', 'Inativo'],
      ['ru-ru', 'Выключен'], ['uk-ua', 'Неактивний'], ['zh-hans', '未激活'],
      ['zh-tw', '未啟用'],
    ]) {
      if (!['en-us', 'zh-tw'].includes(locale)) {
        let response = await fetch(`/translations/${locale}.json`);
        if (!response.ok) {
          throw new Error(`Local translation fixture failed: ${locale} ${response.status}`);
        }
        this.intl.addTranslations(locale, await response.json());
      }
      run(() => this.intl.setLocale([locale, 'en-us']));
      await settled();
      assert.strictEqual(find('.badge').textContent.trim(), expected, locale);
    }
  });

  test('unknown states retain the original display text across locale changes', async function(assert) {
    this.model = EmberObject.create({state: 'vendor-special', displayState: 'Vendor-Special (custom)'});
    await render(precompileTemplate('{{badge-state model=this.model}}'));
    assert.strictEqual(find('.badge').textContent.trim(), 'Vendor-Special (custom)');
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), 'Vendor-Special (custom)');
    run(() => this.model.set('displayState', 'Vendor updated text'));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), 'Vendor updated text');
  });

  test('the model display state retains precedence and changes retain icon and color bindings', async function(assert) {
    this.model = EmberObject.create({
      relevantState: 'running', state: 'active', displayState: 'Running',
      stateIcon: 'icon-check', stateColor: 'text-success', stateBackground: 'bg-success',
    });
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await render(precompileTemplate('{{badge-state model=this.model}}'));
    assert.strictEqual(find('.badge').textContent.trim(), '執行中');
    assert.ok(find('.badge.text-success.bg-success'), 'existing status styling is unchanged');
    assert.ok(find('.badge i.icon-check'), 'existing status icon is unchanged');

    run(() => this.model.setProperties({relevantState: 'stopped', displayState: 'Stopped'}));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), '已停止');
    run(() => this.model.setProperties({relevantState: 'custom-state', displayState: 'Custom-State'}));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), 'Custom-State');
  });

  test('active resources with a health or connection display override retain that original text', async function(assert) {
    this.model = EmberObject.create({state: 'active', relevantState: 'active', displayState: 'Disconnected'});
    await render(precompileTemplate('{{badge-state model=this.model}}'));
    assert.strictEqual(find('.badge').textContent.trim(), 'Disconnected');
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), 'Disconnected', 'a machine state does not override the model display semantics');
    run(() => this.model.set('displayState', 'Active'));
    await settled();
    assert.strictEqual(find('.badge').textContent.trim(), '使用中', 'a known English display state is translated once the override clears');
  });

  test('unknown prototype-like states and missing state do not invent a translation', async function(assert) {
    this.models = ['__proto__', 'constructor', ''].map((state) => EmberObject.create({state, displayState: `original:${state}`}));
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await render(precompileTemplate('{{#each this.models as |model|}}{{badge-state model=model}}{{/each}}'));
    assert.deepEqual(
      [...this.testRoot.querySelectorAll('.badge')].map((badge) => badge.textContent.trim()),
      this.models.map((model) => model.displayState)
    );
  });
});
