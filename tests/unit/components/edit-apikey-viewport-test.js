import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, render, settled, setupContext, setupRenderingContext, teardownContext, waitUntil } from '@ember/test-helpers';
import { selectSearch } from 'ember-power-select/test-support';
import Collection from 'ember-api-store/models/collection';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';
import ApiKeyAudit from 'ui/components/api-key-audit/component';
import auditTemplate from 'ui/components/api-key-audit/template';
import ProjectsService from 'ui/services/projects';

function testKey(store, resourceId = 'viewport-stack') {
  return EmberObject.create({
    id: 'viewport-key', type: 'apiKey', accountId: 'viewport-owner',
    name: 'Viewport regression key', description: '', apiKeyPolicyRevision: 1,
    apiKeyPolicy: {mode: 'custom', defaultEffect: 'deny', expiresAt: null,
      rules: [{id: 'viewport-rule', effect: 'allow', scope: {kind: 'stack', resourceId}, operations: ['read']}]},
    schema: {resourceFields: {apiKeyPolicy: {}}}, store,
    clone() { return testKey(store, resourceId); },
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

function textContrast(frame, node) {
  let rgba = (value) => {
    let channels = value.match(/[\d.]+/g).map(Number);
    return [...channels.slice(0, 3), channels.length === 4 ? channels[3] : 1];
  };
  let ancestors = [];
  for (let parent = node; parent; parent = parent.parentElement) { ancestors.unshift(parent); }
  let background = [255, 255, 255];
  let opacity = 1;
  for (let ancestor of ancestors) {
    let style = frame.contentWindow.getComputedStyle(ancestor);
    let color = rgba(style.backgroundColor);
    background = background.map((channel, index) => color[index] * color[3] + channel * (1 - color[3]));
    opacity *= Number(style.opacity);
  }
  let foreground = rgba(frame.contentWindow.getComputedStyle(node).color);
  let alpha = foreground[3] * opacity;
  foreground = background.map((channel, index) => foreground[index] * alpha + channel * (1 - alpha));
  let luminance = (color) => color.map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  let colors = [luminance(background), luminance(foreground)].sort((a, b) => a - b);
  return (colors[1] + 0.05) / (colors[0] + 0.05);
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
      name: 'Visible environment with a readable human context'},
    {id: 'viewport-other-project', name: 'Another visible environment with a readable human context'}])});
    let projectRows = this.projectRows;
    this.owner.register('service:store', Service.extend({generation: 1,
      getById() { return EmberObject.create(schema); }}));
    this.owner.register('service:user-store', Service.extend({generation: 1,
      find(type, id, options) {
        if (type !== 'project' || id !== null || options.url !== 'projects' ||
          options.forceReload !== true || options.depaginate !== true || options.filter) {
          throw new Error('UnexpectedViewportRead');
        }
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
    this.owner.register('service:projects', ProjectsService.extend({current: EmberObject.create({id: 'viewport-project'}),
      schemaProjectId: 'viewport-project', schemaLoadGeneration: 1}));
    this.owner.register('service:session', Service.extend({accountId: 'viewport-owner'}));
    this.owner.register('service:access', Service.extend({enabled: true, admin: false,
      identity: EmberObject.create({id: 'viewport-identity'})}));
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
      test(`API key empty scope hint contrast: ${locale} ${theme}`, async function(assert) {
        this.intl.setLocale([locale]);
        this.owner.lookup('service:modal').set('modalOpts', testKey(this.owner.lookup('service:user-store'), ''));
        await render(precompileTemplate('{{modal-root}}'));
        await waitUntil(() => find('[data-scope-selector="project"] .ember-power-select-placeholder') &&
          find('[data-scope-selector="project"] .ember-power-select-trigger').getAttribute('aria-disabled') !== 'true');
        let snapshot = find('.modal-overlay').outerHTML;
        for (let width of [390, 1440]) {
          let frame = await viewportFrame(snapshot, theme, locale, width);
          try {
            await painted(frame);
            let hint = frame.contentDocument.querySelector('[data-scope-selector="project"] .ember-power-select-placeholder');
            let ratio = textContrast(frame, hint);
            assert.ok(ratio >= 4.5, `${locale}/${theme}/${width}: unselected actionable hint contrast ${ratio.toFixed(2)} is at least 4.5:1`);
            assert.ok(hint.scrollWidth <= hint.clientWidth + 1, 'translated hint is not horizontally clipped');
            assert.strictEqual(this.writes, 0, 'hint regression performs no API write');
          } finally { frame.remove(); }
        }
      });

      test(`API key scope option contrast: ${locale} ${theme}`, async function(assert) {
        this.intl.setLocale([locale]);
        await render(precompileTemplate('{{modal-root}}'));
        await waitUntil(() => find('.api-key-scope-target .ember-power-select-selected-item') &&
          this.testRoot.textContent.includes('Searchable stack with a readable human name'));
        await click('[data-scope-selector="project"] .ember-power-select-trigger');
        // Searching highlights an unselected candidate through the real
        // aria-current state. A selected option alone uses different CSS.
        await selectSearch('[data-scope-selector="project"]', 'Another visible environment');
        await settled();
        let current = find('[data-scope-selector="project"] .ember-power-select-option[aria-current="true"]');
        assert.ok(current && current.getAttribute('aria-selected') !== 'true', 'real keyboard candidate is highlighted, not already selected');
        let open = find('.modal-overlay').outerHTML;
        await selectSearch('[data-scope-selector="project"]', 'No matching environment name');
        await settled();
        let empty = find('.modal-overlay').outerHTML;
        for (let [phase, snapshot] of [['option', open], ['no-matches', empty]]) {
          for (let width of [390, 1440]) {
            let frame = await viewportFrame(snapshot, theme, locale, width);
            try {
              await painted(frame);
              let options = [...frame.contentDocument.querySelectorAll('[data-scope-selector="project"] .ember-power-select-option')];
              assert.ok(options.length > 0, `${phase}: actual dropdown text is rendered`);
              let listbox = frame.contentDocument.querySelector('[data-scope-selector="project"] [role="listbox"]');
              assert.strictEqual(frame.contentWindow.getComputedStyle(listbox).maxHeight, '360px',
                'scope options use a bounded multi-line region rather than the seven-single-line vendor cap');
              for (let option of options) {
                let ratio = textContrast(frame, option);
                assert.ok(ratio >= 4.5,
                  `${locale}/${theme}/${width}/${phase}: option contrast ${ratio.toFixed(2)} is at least 4.5:1`);
                assert.ok(option.scrollWidth <= option.clientWidth + 1, 'translated option has no horizontal text clipping');
              }
              assert.strictEqual(this.writes, 0, 'visual regression performs no API write');
            } finally { frame.remove(); }
          }
        }
      });

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
            for (let [index, reason] of [...page.querySelectorAll('.api-key-audit-reason')].entries()) {
              let style = frame.contentWindow.getComputedStyle(reason);
              let bounds = reason.getBoundingClientRect();
              let range = page.createRange();
              range.selectNodeContents(reason);
              let fragments = [...range.getClientRects()];
              assert.strictEqual(style.whiteSpace, 'normal', `${locale}/${theme}/${width}: reason wraps despite managed-cell nowrap`);
              assert.strictEqual(style.overflowWrap, 'anywhere', 'long translated words can wrap without widening the column');
              assert.ok(reason.parentElement.classList.contains('table-column-wrap'), 'shared grid does not hide explanatory text');
              assert.ok(bounds.width > 0 && reason.scrollWidth <= reason.clientWidth + 1, 'reason has no horizontally clipped text');
              if (index === 0) { assert.ok(fragments.length > 1, 'the long governance explanation actually occupies multiple lines'); }
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
            if (width === 390) {
              let rule = modal.querySelector('.api-key-rule');
              let column = rule.querySelector('.api-key-scope-target').parentElement;
              let selector = column.querySelector('.ember-power-select-trigger').getBoundingClientRect();
              let row = column.parentElement.getBoundingClientRect();
              assert.strictEqual(frame.contentWindow.getComputedStyle(column).paddingLeft, '0px',
                `${context}: mobile selectors do not retain desktop nested column gutters`);
              assert.ok(Math.abs(selector.width - row.width) <= 2,
                `${context}: searchable scope names use the available rule width`);
            }
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
