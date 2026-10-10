import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { run } from '@ember/runloop';
import { precompileTemplate } from '@ember/template-compilation';
import { click, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import AuditLogsController from 'ui/admin-tab/audit-logs/controller';
import auditTemplate from 'ui/admin-tab/audit-logs/template';
import auditQueryError from 'ui/utils/audit-query-error';
import resolver from '../../../helpers/resolver';

function successfulRows() {
  let rows = A([EmberObject.create({id: 'layout-event', created: '2026-10-10T10:00:00Z',
    eventType: 'layout.change', description: 'Retained successful audit record',
    environmentDisplayName: 'Visible test environment', actorDisplayName: 'Visible test user',
    resourceType: 'stack', interactionChannel: 'web_ui', authType: 'TokenAuth', clientIp: '127.0.0.1'})]);
  rows.set('pagination', EmberObject.create({total: 1}));
  rows.set('filters', EmberObject.create({suggestions: EmberObject.create({actors: A(), clientIps: A(), eventTypes: A()})}));
  return rows;
}

async function renderAuditController(context) {
  // Use the same Ember outlet render contract as @ember/test-helpers/render,
  // but bind the imported route template to its actual controller instance.
  await render(precompileTemplate('{{outlet}}'));
  let lookup = (name) => {
    let template = context.owner.lookup(name);
    return typeof template === 'function' ? template(context.owner) : template;
  };
  run(() => context.owner.lookup('-top-level-view:main').setOutletState({
    render: {owner: context.owner, name: 'application', outlet: 'main',
      template: lookup('template:-outlet'), controller: undefined, ViewClass: undefined, into: undefined},
    outlets: {main: {
      render: {owner: context.owner, name: 'audit-error-layout', outlet: 'main',
        template: lookup('template:audit-error-layout-under-test'), controller: context.subject,
        ViewClass: undefined, into: undefined, outlets: {}},
      outlets: {},
    }},
  }));
  await settled();
}

function viewportFrame(html, theme, locale, width) {
  // Like edit-apikey-viewport-test: snapshot actual Ember-rendered DOM, load
  // the real compiled theme CSS, and control only the iframe viewport.
  // This is component/layout proof, not a native authenticated API run.
  return new Promise((resolve, reject) => {
    let frame = document.createElement('iframe');
    let timer = setTimeout(() => { frame.remove(); reject(new Error('AuditErrorStylesheetLoad')); }, 10000);
    frame.style.cssText = `position:absolute;top:0;left:0;width:${width}px;height:844px;opacity:0;border:0`;
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.srcdoc = `<!doctype html><html lang="${locale}"><head>
      <link rel="stylesheet" href="/assets/vendor.css"><link rel="stylesheet" href="/assets/ui-${theme}.css">
      </head><body class="theme-ui-${theme}"><main class="container-fluid">${html}</main></body></html>`;
    document.getElementById('qunit-fixture').appendChild(frame);
  });
}

function painted(frame) {
  return new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
}

function elementProof(frame, node) {
  let box = node.getBoundingClientRect(), style = frame.contentWindow.getComputedStyle(node);
  let round = value => Math.round(value * 100) / 100;
  // Public geometry/style only: never input values, backend text, URLs or credentials.
  return {tag: node.tagName.toLowerCase(), classes: String(node.getAttribute('class') || '').slice(0, 220),
    bounds: {left: round(box.left), right: round(box.right), top: round(box.top), bottom: round(box.bottom),
      width: round(box.width), height: round(box.height)},
    clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
    styles: {display: style.display, visibility: style.visibility, position: style.position,
      width: style.width, minWidth: style.minWidth, maxWidth: style.maxWidth, boxSizing: style.boxSizing,
      whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, overflowX: style.overflowX,
      color: style.color, background: style.backgroundColor, opacity: style.opacity}};
}

function pageOverflowProof(frame, width) {
  let page = frame.contentDocument;
  let offenders = [...page.body.querySelectorAll('*')].filter(node => {
    let box = node.getBoundingClientRect(), style = frame.contentWindow.getComputedStyle(node);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility === 'visible' &&
      (box.left < -1 || box.right > width + 1);
  }).sort((left, right) => {
    let extent = node => { let box = node.getBoundingClientRect(); return Math.max(-box.left, box.right - width); };
    return extent(right) - extent(left);
  }).slice(0, 12).map(node => ({element: elementProof(frame, node),
    parent: node.parentElement ? elementProof(frame, node.parentElement) : null}));
  return {viewportWidth: width, documentScrollWidth: page.documentElement.scrollWidth,
    bodyScrollWidth: page.body.scrollWidth, scrollX: frame.contentWindow.scrollX, offenders};
}

function diagnostic(label, width, kind, proof) {
  let result = {scope: 'ACTUAL_EMBER_DOM_COMPILED_CSS_FIXTURE_NOT_AUTHENTICATED_NATIVE',
    case: label, width, kind, proof};
  console.info(`AUDIT_ERROR_LAYOUT_DIAGNOSTIC ${JSON.stringify(result)}`);
}

function textContrast(frame, node) {
  let rgba = value => {
    let channels = value.match(/[\d.]+/g).map(Number);
    return [...channels.slice(0, 3), channels.length === 4 ? channels[3] : 1];
  };
  let ancestors = [];
  for (let parent = node; parent; parent = parent.parentElement) { ancestors.unshift(parent); }
  let background = [255, 255, 255], opacity = 1;
  for (let ancestor of ancestors) {
    let style = frame.contentWindow.getComputedStyle(ancestor), color = rgba(style.backgroundColor);
    background = background.map((channel, index) => color[index] * color[3] + channel * (1 - color[3]));
    opacity *= Number(style.opacity);
  }
  let foreground = rgba(frame.contentWindow.getComputedStyle(node).color), alpha = foreground[3] * opacity;
  foreground = background.map((channel, index) => foreground[index] * alpha + channel * (1 - alpha));
  let luminance = color => color.map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  let colors = [luminance(background), luminance(foreground)].sort((a, b) => a - b);
  return {ratio: (colors[1] + 0.05) / (colors[0] + 0.05), foreground, background,
    element: elementProof(frame, node)};
}

module('admin tab | audit logs error layout', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    this.apiAttempts = 0;
    this.sent = [];
    let context = this;
    this.routeBoundary = {send(action, options) {
      context.sent.push({action, options});
      // A route boundary adapter accepts recovery; it never loads or writes API data.
      if (context.subject) { context.subject.set('isFiltering', false); }
    }};
    // Ember Controller.init replaces a supplied target with router:main. Keep
    // that owner dependency isolated from an unbooted application router too.
    this.owner.register('router:main', Service.extend({
      send(action, options) { context.routeBoundary.send(action, options); },
      transitionTo() { throw new Error('AuditErrorLayoutMustNotRoute'); },
    }));
    initializePodLayouts();
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    for (let locale of ['en-us', 'zh-tw']) {
      this.intl.addTranslations(locale, await (await fetch(`/translations/${locale}.json`)).json());
    }
    await setupRenderingContext(this);
    this.owner.register('template:audit-error-layout-under-test', auditTemplate);
    this.owner.register('service:user-store', Service.extend({headers: {},
      rawRequest() { context.apiAttempts++; throw new Error('AuditErrorLayoutMustNotRequestAPI'); }}));
    this.owner.register('service:access', Service.extend({captureGeneration() { return 'layout-authorization'; }}));
    this.owner.register('service:modal', Service.extend({toggleModal() { throw new Error('AuditErrorLayoutMustNotOpenModal'); }}));
    this.owner.register('controller:audit-error-layout-under-test', AuditLogsController);
    this.subject = this.owner.factoryFor('controller:audit-error-layout-under-test').create({
      application: EmberObject.create(),
    });
    this.subject.set('target', this.routeBoundary);
  });

  hooks.afterEach(async function() {
    run(() => this.subject.destroy());
    await teardownContext(this);
    this.testRoot.remove();
  });

  for (let locale of ['en-us', 'zh-tw']) {
    for (let theme of ['light', 'dark']) {
      test(`${locale}/${theme}: four real error states fit 390px and 1440px and retain recovery`, async function(assert) {
        this.intl.setLocale([locale]);
        assert.strictEqual(this.subject.get('target'), this.routeBoundary, 'actual controller recovery is isolated from application routing');
        let phases = [
          {name: 'too-large', query: auditQueryError({status: 422, body: {code: 'result_set_too_large'}})},
          {name: 'forbidden', query: auditQueryError({status: 403})},
          {name: 'query-and-export', query: auditQueryError({status: 422, body: {code: 'result_set_too_large'}}),
            exportError: auditQueryError({status: 422, body: {code: 'export_too_large'}})},
          {name: 'export-only-successful-query', query: null,
            exportError: auditQueryError({status: 422, body: {code: 'export_too_large'}})},
        ];
        for (let phase of phases) {
          this.subject.setProperties({model: EmberObject.create({queryError: phase.query,
            auditLog: phase.query ? null : successfulRows(), projects: A(), resourceTypes: A()}),
          accountId: 'layout-filter-environment', authenticatedAsAccountId: 'layout-filter-user',
          eventType: 'layout.change', timeScope: 'all', createdFrom: null, createdTo: null,
          isFiltering: false, isExporting: false});
          this.subject.syncDraftFromQuery();
          this.subject.set('exportError', phase.exportError || null);
          await renderAuditController(this);
          let root = this.element;
          let label = `${locale}/${theme}/${phase.name}`;
          assert.ok(root.querySelector('[data-testid="audit-log-filter-panel"]'), `${label}: real filter form remains rendered`);
          assert.strictEqual(root.querySelector('#audit-log-event-type').value, 'layout.change', 'filter text is retained');
          assert.notOk(root.textContent.includes('Missing translation'), 'actual locale messages are used');
          assert.ok(root.textContent.includes(this.intl.t('auditLogsPage.queryErrors.selectedUserUnavailable')), 'retained unnamed user is not relabeled as all users');
          assert.ok(root.textContent.includes(this.intl.t('auditLogsPage.queryErrors.selectedEnvironmentUnavailable')), 'retained unnamed environment is not relabeled as all environments');
          if (phase.query) {
            let error = root.querySelector('[data-testid="audit-log-query-error"]');
            assert.ok(error.textContent.includes(this.intl.t(phase.query.messageKey)), 'query failure has human-readable translation');
            assert.notOk(root.querySelector('.audit-log-results-status'), 'failed query has no successful zero-record summary');
            assert.notOk(root.querySelector('.audit-log-results-table'), 'failed query has no misleading empty result table');
            assert.strictEqual(Boolean(root.querySelector('[data-testid="audit-log-query-recent"]')), phase.query.canNarrow, 'only narrowable failures offer recent 15 minutes');
            assert.ok(root.querySelector('[data-testid="audit-log-export"]').disabled, 'a failed query cannot export a fake empty result');
          } else {
            assert.ok(root.querySelector('.audit-log-results-table').textContent.includes('Retained successful audit record'), 'standalone export failure retains successful records');
            assert.strictEqual(root.querySelector('.audit-log-results-status').textContent.trim(),
              this.intl.t('auditLogsPage.filterBuilder.results.summary', {count: 1, range: this.subject.get('appliedRangeSummary')}), 'successful summary retains the actual nonzero count');
          }
          if (phase.exportError) {
            assert.strictEqual(root.querySelector('[data-testid="audit-log-export-error"]').textContent.trim(),
              this.intl.t(phase.exportError.messageKey), 'export error is safely translated, not a backend error file');
          }
          for (let width of [390, 1440]) {
            let frame = await viewportFrame(root.innerHTML, theme, locale, width);
            try {
              await painted(frame);
              let page = frame.contentDocument;
              for (let error of page.querySelectorAll('[data-testid="audit-log-query-error"], [data-testid="audit-log-export-error"]')) {
                error.scrollIntoView({block: 'center'});
                await painted(frame);
                for (let node of [error, ...error.querySelectorAll('p, button')]) {
                  let box = node.getBoundingClientRect();
                  let proof = elementProof(frame, node);
                  assert.ok(box.width > 0 && box.left >= -1 && box.right <= width + 1,
                    `${label}/${width}: error/control stays horizontally inside viewport; ${JSON.stringify(proof)}`);
                  assert.ok(box.top >= -1 && box.bottom <= 845,
                    `${label}/${width}: error/control can scroll fully into view; ${JSON.stringify(proof)}`);
                  assert.ok(node.scrollWidth <= node.clientWidth + 1,
                    `${label}/${width}: error/control has no horizontal clipping; ${JSON.stringify(proof)}`);
                }
                let text = error.querySelector('p') || error;
                let contrast = textContrast(frame, text);
                if (contrast.ratio < 4.5) { diagnostic(label, width, 'contrast', contrast); }
                assert.ok(contrast.ratio >= 4.5,
                  `${label}/${width}: error text contrast=${contrast.ratio.toFixed(4)} >=4.5; ${JSON.stringify(contrast)}`);
                assert.strictEqual(error.getAttribute('role'), 'alert', 'the error is conveyed by readable text and semantics, not color alone');
              }
              for (let control of page.querySelectorAll('[data-testid="audit-log-query-retry"], [data-testid="audit-log-query-recent"], [data-testid="audit-log-filter-apply"]')) {
                let box = control.getBoundingClientRect();
                assert.ok(box.width > 0 && box.left >= -1 && box.right <= width + 1 && !control.disabled,
                  `${label}/${width}: action is enabled and fits viewport; ${JSON.stringify(elementProof(frame, control))}`);
              }
              let overflow = pageOverflowProof(frame, width);
              if (overflow.documentScrollWidth > width + 1) { diagnostic(label, width, 'page-overflow', overflow); }
              assert.ok(overflow.documentScrollWidth <= width + 1,
                `${label}/${width}: page must not widen; ${JSON.stringify(overflow)}`);
            } finally { frame.remove(); }
          }
          if (phase.query) {
            await click(root.querySelector('[data-testid="audit-log-query-retry"]'));
            assert.strictEqual(this.sent[this.sent.length - 1].action, 'retryAuditQuery', 'real rendered Retry action reaches the route boundary');
            if (phase.query.canNarrow) {
              await click(root.querySelector('[data-testid="audit-log-query-recent"]'));
              assert.strictEqual(this.sent[this.sent.length - 1].action, 'filterLogs', 'real rendered recent-15-minute action runs the controller recovery');
              assert.strictEqual(this.subject.get('activeTimePreset'), 'minutes15');
            }
          }
          await click(root.querySelector('[data-testid="audit-log-filter-apply"]'));
          assert.strictEqual(this.sent[this.sent.length - 1].action, 'filterLogs', 'real retained form submits the actual controller search');
          assert.strictEqual(this.subject.get('accountId'), 'layout-filter-environment', 'recovery preserves environment filtering');
          assert.strictEqual(this.subject.get('authenticatedAsAccountId'), 'layout-filter-user', 'recovery preserves user filtering');
          assert.strictEqual(this.apiAttempts, 0, 'layout/actions perform no API calls or writes');
        }
      });
    }
  }
});
