import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { alias } from '@ember/object/computed';
import Component, { setComponentTemplate } from '@ember/component';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, findAll, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { reject } from 'rsvp';
import StacksController from 'ui/stacks/index/controller';
import StacksTemplate from 'ui/stacks/index/template';
import StackSection from 'ui/components/stack-section/component';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import { archiveFixture } from '../../helpers/archive';
import resolver from '../../helpers/resolver';

const LOCALES = ['de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw'];
const KEYS = ['filterLabel', 'include', 'badge', 'action', 'restore', 'show', 'stackCount', 'hiddenCount',
  'emptyStacks', 'emptyServices', 'confirmTitle', 'restoreTitle', 'explanation', 'restoreExplanation',
  'dataWarning', 'requiresStopped', 'system', 'readOnly', 'alreadyChanged', 'restoreBeforeStart',
  'createUnsupported', 'mixedUpdate', 'concurrentChange'];

module('Integration | Component | archive', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    this.testRoot.style.width = '320px';
    document.body.appendChild(this.testRoot);
    this.f = archiveFixture();
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    this.english = await (await fetch('/translations/en-us.json')).json();
    this.intl.addTranslations('en-us', this.english);
    this.intl.setLocale(['en-us']);
    this.owner.register('service:projects', this.f.projects, {instantiate: false});
    this.prefs = EmberObject.create({userStore: EmberObject.create({generation: 1})});
    this.owner.register('service:prefs', this.prefs, {instantiate: false});
    this.closed = 0;
    let context = this;
    this.owner.register('service:modal', Service.extend({modalVisible: true, modalOpts: null,
      toggleModal() { context.closed++; },
    }));
    this.modal = this.owner.lookup('service:modal');
    // These unrelated routing/overlay widgets are outside this component test.
    let Link = Component.extend({tagName: 'a'});
    setComponentTemplate(precompileTemplate('{{yield}}'), Link);
    this.owner.register('component:link-to', Link);
    for (let name of ['tooltip-element', 'badge-state', 'upgrade-btn', 'service-addtl-info', 'hero-add-service']) {
      let Stub = Component.extend({});
      setComponentTemplate(precompileTemplate('{{yield}}'), Stub);
      this.owner.register(`component:${name}`, Stub);
    }
    let Menu = Component.extend({});
    setComponentTemplate(precompileTemplate('<button aria-label="More actions">⋮</button>'), Menu);
    this.owner.register('component:action-menu', Menu);
    this.owner.register('component:stack-section', StackSection.extend({collapsed: false}));
    let Page = Component.extend({
      controller: null,
      pageHeader: alias('controller.pageHeader'), which: alias('controller.which'), tags: alias('controller.tags'),
      projects: alias('controller.projects'), model: alias('controller.model'), sortBy: alias('controller.sortBy'),
      showArchived: alias('controller.showArchived'), arranged: alias('controller.arranged'),
      scopedStacks: alias('controller.scopedStacks'), hiddenStackCount: alias('controller.hiddenStackCount'),
      canCreateStack: false,
      actions: {
        toggleArchived() { this.get('controller').send('toggleArchived'); },
        showArchivedResources() { this.get('controller').send('showArchivedResources'); },
        sortResults(value) { this.get('controller').send('sortResults', value); },
      },
    });
    setComponentTemplate(StacksTemplate, Page);
    this.owner.register('component:archive-stacks-page', Page);
    this.controller = StacksController.create({projects: this.f.projects, prefs: this.prefs,
      stacksController: EmberObject.create({which: 'user', tags: ''}), model: {stacks: A([])},
    });
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.controller.destroy();
    this.f.destroy();
    this.testRoot.remove();
  });

  test('native page switch precedes sorting and toggles empty archive view, badges and real total counts', async function(assert) {
    let service = this.f.service({id: '1s1', archived: true, displayName: 'Archived service', intl: this.intl,
      launchConfig: {imageUuid: 'docker:alpine'}, instances: A([EmberObject.create({state: 'stopped'})])});
    let stack = this.f.stack({archived: true, displayName: 'Archived stack', services: A([service])});
    this.controller.set('model', {stacks: A([stack])});
    await render(precompileTemplate('{{archive-stacks-page controller=this.controller}}'));
    assert.ok(find('[data-testid="archive-empty"]'), 'all archived is distinct from no resources');
    let toggle = find('[data-testid="archive-filter"]');
    assert.strictEqual(toggle.getAttribute('role'), 'switch');
    assert.strictEqual(toggle.getAttribute('aria-checked'), 'false');
    assert.true(!!(toggle.compareDocumentPosition(find('.stacks-sort')) & Node.DOCUMENT_POSITION_FOLLOWING), 'archive precedes sort in reading order');
    assert.strictEqual(findAll('[data-testid="archive-stack-badge"]').length, 0);
    await click(toggle);
    assert.strictEqual(toggle.getAttribute('aria-checked'), 'true');
    assert.strictEqual(findAll('[data-testid="archive-stack-badge"]').length, 1);
    assert.strictEqual(findAll('[data-testid="archive-service-badge"]').length, 1);
    assert.ok(find('[data-testid="archive-stack-count"]').textContent.includes('1 stacks total'), 'total remains explicit');
    stack.set('archived', false);
    await click(toggle);
    assert.ok(find('[data-testid="archive-hidden-service-count"]').textContent.includes('1 hidden'));
    assert.strictEqual(find('.count.has-hidden p').textContent.trim(), '1', 'hidden child stays in total');
    assert.strictEqual(findAll('[data-testid="archive-service-badge"]').length, 0);
    await click(find('.stack-body .btn'));
    assert.strictEqual(toggle.getAttribute('aria-checked'), 'true', 'hidden-service shortcut uses the same preference');
    let toolbar = find('.stacks-toolbar');
    assert.ok(toolbar.scrollWidth <= toolbar.clientWidth + 1, 'controls wrap inside the 320px container');
  });

  test('actual English and Traditional Chinese modal warns about retained mount data and disables unsafe submit', async function(assert) {
    for (let locale of ['en-us', 'zh-tw']) {
      let messages = locale === 'en-us' ? this.english : await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, messages);
      this.intl.setLocale([locale]);
      let resource = this.f.service({state: 'active', displayName: 'A very long resource name '.repeat(8)});
      this.modal.set('modalOpts', {originalModel: resource, archived: true});
      await render(precompileTemplate('{{modal-confirm-archive}}'));
      assert.strictEqual(find('[data-testid="archive-data-warning"]').textContent.trim(), messages['archive.dataWarning']);
      assert.strictEqual(find('[data-testid="archive-block-reason"]').textContent.trim(), messages['archive.requiresStopped']);
      assert.true(find('[data-testid="archive-confirm"]').disabled);
      assert.strictEqual(document.activeElement, find('[data-testid="archive-cancel"]'), 'safe native action receives focus');
      resource.set('state', 'inactive');
      await settled();
      assert.false(find('[data-testid="archive-confirm"]').disabled, 'live stop update enables confirmation');
      assert.notOk(find('[data-testid="archive-block-reason"]'));
      let modal = find('.archive-modal');
      assert.ok(modal.scrollWidth <= modal.clientWidth + 1, 'long name wraps without modal overflow');
    }
  });

  test('all 13 shipped locale assets have actual archive messages with matching ICU arguments and no English fallback', async function(assert) {
    let expectedArgs = key => [...this.english[`archive.${key}`].matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).sort();
    for (let locale of LOCALES) {
      let response = await fetch(`/translations/${locale}.json`);
      assert.true(response.ok, `${locale}: actual compiled asset`);
      let messages = await response.json();
      this.intl.addTranslations(locale, messages);
      this.intl.setLocale([locale]);
      for (let key of KEYS) {
        let value = messages[`archive.${key}`];
        assert.ok(typeof value === 'string' && value.trim(), `${locale}: ${key}`);
        assert.deepEqual([...value.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).sort(), expectedArgs(key), `${locale}: ${key} arguments`);
        let rendered = String(this.intl.t(`archive.${key}`, {total: 2, hidden: 1, count: 1}));
        assert.notOk(rendered.includes('Missing translation'), `${locale}: ${key} formats without fallback`);
      }
      if (locale !== 'en-us') {
        assert.notStrictEqual(messages['archive.dataWarning'], this.english['archive.dataWarning'], `${locale}: storage warning is translated`);
      }
    }
  });

  test('a rejected save displays the existing visible error banner and leaves Cancel available', async function(assert) {
    let writes = 0;
    let resource = this.f.service({displayName: 'Stopped service', save() {
      writes++;
      return reject({status: 409, code: 'ArchiveConcurrentChange', message: 'raw server message'});
    }});
    this.modal.set('modalOpts', {originalModel: resource, archived: true});
    await render(precompileTemplate('{{modal-confirm-archive}}'));
    await click('[data-testid="archive-confirm"]');
    let banner = find('.top-errors.alert-danger:not(.hide)');
    assert.ok(banner, 'failure is actually visible, not merely a mounted hidden alert');
    assert.ok(banner.textContent.includes(this.english['archive.concurrentChange']));
    assert.notOk(banner.textContent.includes('raw server message'));
    assert.false(find('[data-testid="archive-confirm"]').disabled, 'save lock is released');
    assert.false(find('[data-testid="archive-cancel"]').disabled);
    assert.strictEqual(writes, 1);
    assert.strictEqual(this.closed, 0, 'failure keeps the form open');
    await click('[data-testid="archive-cancel"]');
    assert.strictEqual(this.closed, 1);
  });

  test('slide uses the actual generated LTR and RTL theme stylesheets and textual state', async function(assert) {
    await render(precompileTemplate('{{archive-stacks-page controller=this.controller}}'));
    let toggle = find('[data-testid="archive-filter"]');
    let thumb = toggle.querySelector('.archive-switch-thumb');
    assert.ok(toggle.textContent.includes('OFF'), 'color is not the sole state cue');
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    assert.strictEqual(getComputedStyle(thumb).transitionDuration, reducedMotion ? '0s' : '0.18s',
      'compiled animation follows the actual accessibility media preference');
    await click(toggle);
    assert.ok(toggle.textContent.includes('ON'));
    await waitUntil(() => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41 === 36);
    assert.strictEqual(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41, 36, 'LTR thumb slides forward');
    let stylesheet = document.querySelector('link[href*="ui-light.css"]');
    let originalHref = stylesheet.getAttribute('href');
    let originalDir = document.documentElement.getAttribute('dir');
    async function loadStyle(href) {
      await new Promise((resolve, reject) => {
        stylesheet.addEventListener('load', resolve, {once: true});
        stylesheet.addEventListener('error', reject, {once: true});
        stylesheet.setAttribute('href', href);
      });
    }
    try {
      document.documentElement.setAttribute('dir', 'rtl');
      await loadStyle('/assets/ui-light.rtl.css');
      await waitUntil(() => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41 === -36);
      assert.strictEqual(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41, -36, 'actual RTL compiler output reverses exactly once');
      let track = toggle.getBoundingClientRect();
      let knob = thumb.getBoundingClientRect();
      assert.ok(knob.left >= track.left && knob.right <= track.right, 'the RTL thumb remains inside the switch');
    } finally {
      if ( originalDir === null ) { document.documentElement.removeAttribute('dir'); }
      else { document.documentElement.setAttribute('dir', originalDir); }
      await loadStyle(originalHref);
    }
  });
});
