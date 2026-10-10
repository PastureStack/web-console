import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import { find, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import Collection from 'ember-api-store/models/collection';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';
import ApiKeyAudit from 'ui/components/api-key-audit/component';
import auditTemplate from 'ui/components/api-key-audit/template';

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
      test(`API key audit reason viewport layout: ${locale} ${theme}`, async function(assert) {
        this.intl.setLocale([locale]);
        let context = this;
        let capturedAudit = ApiKeyAudit.extend({
          didInsertElement() { this._super(...arguments); context.audit = this; },
        });
        setComponentTemplate(auditTemplate, capturedAudit);
        this.owner.register('component:api-key-audit', capturedAudit);
        // A null key performs no request and installs no polling timer. The
        // displayed records still use the product's actual safeRecord/template.
        await render(precompileTemplate('{{api-key-audit}}'));
        this.audit.set('rows', ['KeyGovernanceCompleted', 'OwnerPermissionDenied'].map((reason, index) =>
          this.audit.safeRecord({id: `viewport-event-${index}`, created: '2026-10-10T10:00:00Z',
            operation: 'read', decision: index ? 'DENY' : 'ALLOW', phase: 'response',
            outcome: index ? 'DENIED' : 'SUCCEEDED', httpStatus: index ? 403 : 200,
            targetType: 'apiKey', requestId: `viewport-request-${index}`, reason})));
        await settled();
        let snapshot = find('.api-key-audit').cloneNode(true);
        let table = snapshot.querySelector('table');
        // Reproduce the real manager's fixed-column contract, not just an
        // uninitialized table. Native acceptance separately runs the manager.
        table.setAttribute('data-resizable-columns', 'true');
        table.style.cssText = 'table-layout:fixed;width:1066px;min-width:1066px;max-width:none';
        let columns = document.createElement('colgroup');
        for (let width of [160, 90, 120, 96, 100, 100, 120, 180, 100]) {
          let column = document.createElement('col');
          column.style.width = `${width}px`;
          columns.appendChild(column);
        }
        table.prepend(columns);
        for (let width of [390, 1440]) {
          let frame = await viewportFrame(`<main class="container-fluid">${snapshot.outerHTML}</main>`, theme, locale, width);
          try {
            await painted(frame);
            let page = frame.contentDocument;
            assert.notOk(page.body.textContent.includes('Missing translation'), 'translated audit wording is present');
            for (let reason of page.querySelectorAll('.api-key-audit-reason')) {
              let style = frame.contentWindow.getComputedStyle(reason);
              let bounds = reason.getBoundingClientRect();
              let range = page.createRange();
              range.selectNodeContents(reason);
              let fragments = [...range.getClientRects()];
              assert.strictEqual(style.whiteSpace, 'normal', `${locale}/${theme}/${width}: reason wraps despite managed-cell nowrap`);
              assert.strictEqual(style.overflowWrap, 'anywhere', 'long translated words can wrap without widening the column');
              assert.ok(reason.parentElement.classList.contains('table-column-wrap'), 'shared grid does not hide explanatory text');
              assert.ok(bounds.width > 0 && reason.scrollWidth <= reason.clientWidth + 1, 'reason has no horizontally clipped text');
              assert.ok(fragments.length > 1, 'long reason actually occupies multiple lines');
              assert.ok(fragments.every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
                rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1), 'every text fragment is inside its visible box');
              assert.strictEqual(style.color, frame.contentWindow.getComputedStyle(reason.closest('.api-key-audit')).color,
                'explanation uses the readable theme foreground');
            }
            assert.ok(page.documentElement.scrollWidth <= width + 1, 'table overflow stays in its local scroll region');
            assert.strictEqual(this.writes, 0, 'text layout regression makes no API write');
          } finally { frame.remove(); }
        }
      });

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
            for (let [selector, display] of [['table', 'table'], ['caption', 'table-caption'],
              ['thead', 'table-header-group'], ['thead tr', 'table-row'], ['tbody', 'table-row-group'], ['tbody tr', 'table-row']]) {
              let node = selector === 'table' ? table : table.querySelector(selector);
              let style = frame.contentWindow.getComputedStyle(node);
              assert.strictEqual(style.display, display, `${context}: ${selector} retains matrix semantics`);
              assert.notStrictEqual(style.visibility, 'hidden', `${context}: ${selector} is not hidden by record-list styling`);
              assert.ok(node.getBoundingClientRect().height > 0, `${context}: ${selector} has visible content`);
            }
            assert.ok(table.querySelector('caption').getBoundingClientRect().width >= table.getBoundingClientRect().width - 2,
              `${context}: caption does not collapse into a vertical character column`);
            assert.strictEqual(frame.contentWindow.getComputedStyle(table.querySelector('caption')).color,
              frame.contentWindow.getComputedStyle(table).color, `${context}: caption uses readable theme text`);
            for (let selector of ['thead tr', 'tbody tr']) {
              let cells = [...table.querySelector(selector).children];
              assert.strictEqual(cells.length, 9, `${context}: target and eight operation columns remain present`);
              let firstTop = cells[0].getBoundingClientRect().top;
              cells.forEach((cell, index) => {
                let rect = cell.getBoundingClientRect();
                assert.strictEqual(frame.contentWindow.getComputedStyle(cell).display, 'table-cell', `${context}: cell is not a stacked record`);
                assert.ok(rect.width >= 70 && rect.height > 0, `${context}: cell is readable`);
                assert.ok(Math.abs(rect.top - firstTop) <= 2, `${context}: cells share one horizontal row`);
                if (index) { assert.ok(rect.left >= cells[index - 1].getBoundingClientRect().right - 2, `${context}: operation columns do not overlap`); }
              });
            }
            for (let span of table.querySelectorAll('td > span')) {
              let style = frame.contentWindow.getComputedStyle(span);
              assert.strictEqual(style.color, frame.contentWindow.getComputedStyle(span.parentElement).color,
                `${context}: state wording uses readable theme text, not decorative state colors`);
              assert.ok(Number(style.fontWeight) >= 600, `${context}: state wording remains visually distinct without color alone`);
            }
            for (let node of modal.querySelectorAll('.help-block, .alert')) {
              assert.strictEqual(frame.contentWindow.getComputedStyle(node).color, frame.contentWindow.getComputedStyle(modal).color,
                `${context}: help and alert wording uses readable theme text`);
            }
            if (width === 390) {
              assert.ok(scroll.scrollWidth > scroll.clientWidth, `${context}: wide matrix scrolls internally`);
              scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
              assert.ok(scroll.scrollLeft > 0, `${context}: matrix horizontal scrolling is usable`);
              let lastHeading = table.querySelector('thead th:last-child').getBoundingClientRect();
              let region = scroll.getBoundingClientRect();
              assert.ok(lastHeading.right <= region.right + 2 && lastHeading.left < region.right,
                `${context}: scrolling exposes the last operation, not empty stacked cells`);
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
