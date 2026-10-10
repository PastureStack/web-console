import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import Collection from 'ember-api-store/models/collection';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

function testKey(store) {
  return EmberObject.create({
    id: 'viewport-key', type: 'apiKey', accountId: 'viewport-owner',
    name: 'Viewport regression key', description: '', apiKeyPolicyRevision: 1,
    apiKeyPolicy: {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
      rules: [{id: 'viewport-rule', effect: 'allow', scope: {kind: 'stack', resourceId: 'viewport-stack'}, operations: ['read']}]},
    schema: {resourceFields: {apiKeyPolicy: {}}}, store,
    clone() { return testKey(store); },
  });
}

// Use the actual rendered editor/modal-root DOM and actual compiled theme CSS.
// Only the iframe's viewport is controlled; no product CSS is injected.
function viewportFrame(html, theme, locale, width) {
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => reject(new Error(`Viewport stylesheet load: ${theme}`)), 10000);
    frame.style.cssText = `position:absolute;top:0;left:0;width:${width}px;height:844px;opacity:0;border:0`;
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.srcdoc = `<!doctype html><html lang="${locale}"><head>
      <link rel="stylesheet" href="/assets/vendor.css">
      <link rel="stylesheet" href="/assets/ui-${theme}.css">
      </head><body class="theme-ui-${theme}">${html}</body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

function painted(frame) {
  return new Promise((resolve) => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
}

module('Integration | Component | API key editor viewport layout', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      this.intl.addTranslations(locale, await (await fetch(`/translations/${locale}.json`)).json());
    }
    await setupRenderingContext(this);
    this.writes = 0;
    let context = this;
    let stack = {id: 'viewport-stack', type: 'stack', accountId: 'viewport-project',
      name: 'Searchable stack with a readable human name', description: 'Scope description',
      links: {self: '/viewport-unit/stack'}, actionLinks: {}};
    let schema = {id: 'stack', collectionMethods: ['GET'], resourceMethods: ['GET'],
      resourceActions: {}, resourceLinks: [], links: {collection: '/viewport-unit/stacks'}};
    this.projectRows = Collection.create({content: A([{id: 'viewport-project',
      name: 'Visible environment with a readable human context'}])});
    let projectRows = this.projectRows;
    this.owner.register('service:store', Service.extend({generation: 1,
      getById() { return EmberObject.create(schema); }}));
    this.owner.register('service:user-store', Service.extend({generation: 1,
      find(type, id, options) {
        if (type !== 'project' || id !== null || options.forceReload !== true) { throw new Error('UnexpectedViewportRead'); }
        return Promise.resolve(projectRows);
      },
      rawRequest(options) {
        if (options.method !== 'GET') { context.writes++; throw new Error('ViewportTestMustNotWrite'); }
        let body;
        if (options.url === 'schema' || options.url.endsWith('/schema')) { body = {data: [schema]}; }
        else if (options.url === '/viewport-unit/stacks') { body = {data: [stack]}; }
        else if (options.url === stack.links.self) { body = stack; }
        else { throw new Error('UnexpectedViewportRead'); }
        return Promise.resolve({body});
      }}));
    this.owner.register('service:projects', Service.extend({current: EmberObject.create({id: 'viewport-project'}),
      schemaProjectId: 'viewport-project', schemaLoadGeneration: 1}));
    this.owner.register('service:session', Service.extend({accountId: 'viewport-owner'}));
    this.owner.register('service:access', Service.extend({identity: EmberObject.create({id: 'viewport-identity'})}));
    this.owner.register('service:endpoint', Service.extend({absolute: 'https://unit.invalid/'}));
    this.owner.register('service:modal', Service.extend({modalVisible: true, modalType: 'edit-apikey', modalOpts: null,
      toggleModal() { this.set('modalVisible', false); }}));
    this.owner.lookup('service:modal').set('modalOpts', testKey(this.owner.lookup('service:user-store')));
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.projectRows.destroy();
    this.testRoot.remove();
  });

  for (let locale of ['en-us', 'zh-tw']) {
    for (let theme of ['light', 'dark']) {
      test(`${locale} ${theme}: actual modal and footer layout fit 390px and desktop`, async function(assert) {
        this.intl.setLocale([locale]);
        await render(precompileTemplate('{{modal-root}}'));
        await waitUntil(() => find('.api-key-scope-target .ember-power-select-selected-item') &&
          this.testRoot.textContent.includes('Searchable stack with a readable human name'));
        await settled();
        let overlay = find('.modal-overlay');
        assert.ok(overlay && find('[data-policy-matrix="draft"]'), 'real modal-root/editor and matrix rendered');
        assert.notOk(this.testRoot.textContent.includes('Missing translation'), 'real locale messages are present');
        for (let width of [390, 1440]) {
          // Each case starts at its actual viewport. This is layout proof only;
          // real keyboard focus remains the separate native UI19 gate.
          let frame = await viewportFrame(overlay.outerHTML, theme, locale, width);
          try {
            let page = frame.contentDocument;
            let modal = page.querySelector('.modal-container');
            let form = modal.querySelector('.horizontal-form');
            let fieldset = modal.querySelector('fieldset');
            let footer = modal.querySelector('.footer-actions');
            let review = footer.querySelector('.btn-primary');
            let scroll = modal.querySelector('.api-key-policy-matrix-scroll');
            let table = scroll.querySelector('table');
            await painted(frame);
            let context = `${locale}/${theme}/${width}px`;
            let bounds = modal.getBoundingClientRect();
            assert.ok(bounds.width > 0 && bounds.left >= -1 && bounds.right <= width + 1,
              `${context}: actual modal stays inside viewport (left=${bounds.left}, right=${bounds.right})`);
            for (let [name, node] of [['form', form], ['fieldset', fieldset], ['footer', footer], ['review', review],
              ['cancel', footer.querySelector('.btn-link')]]) {
              let rect = node.getBoundingClientRect();
              assert.ok(rect.width > 0 && rect.left >= -1 && rect.right <= width + 1,
                `${context}: ${name} is not clipped (left=${rect.left}, right=${rect.right})`);
            }
            assert.ok(page.documentElement.scrollWidth <= width + 1,
              `${context}: matrix does not widen the document (${page.documentElement.scrollWidth}px)`);
            assert.strictEqual(frame.contentWindow.getComputedStyle(scroll).overflowX, 'auto', `${context}: matrix keeps its own horizontal scroll`);
            assert.ok(table.getBoundingClientRect().width >= 759, `${context}: all eight matrix columns keep their minimum readable width`);
            if (width === 390) {
              assert.ok(scroll.scrollWidth > scroll.clientWidth, `${context}: wide matrix scrolls internally`);
              scroll.scrollLeft = 40;
              assert.ok(scroll.scrollLeft > 0, `${context}: matrix horizontal scrolling is usable`);
            } else {
              assert.ok(Math.abs(bounds.width - 990) <= 1, `${context}: existing desktop maximum width is retained`);
            }
            assert.notStrictEqual(frame.contentWindow.getComputedStyle(modal).overflowX, 'hidden', `${context}: no hidden overflow masks clipping`);
            let unrelated = page.createElement('div');
            unrelated.className = 'lacsso modal-container large-modal';
            unrelated.innerHTML = '<fieldset><legend>Unrelated modal</legend></fieldset>';
            page.body.appendChild(unrelated);
            assert.strictEqual(frame.contentWindow.getComputedStyle(unrelated.querySelector('fieldset')).minWidth, '0px',
              'an unrelated modal retains the existing Bootstrap fieldset reset');
            assert.strictEqual(frame.contentWindow.getComputedStyle(unrelated).width, `${Math.min(page.documentElement.clientWidth - 40, 990)}px`,
              `${context}: an unrelated large modal retains its existing width`);
            assert.strictEqual(this.writes, 0, 'viewport regression does not issue preview, PUT or any other write');
          } finally { frame.remove(); }
        }
      });
    }
  }
});
