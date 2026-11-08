'use strict';

// Focused controller/service tests. No browser, framework install or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(__dirname, '../app');
const filterArg = process.argv.find(arg => arg.startsWith('--filter='));
const filter = filterArg && filterArg.slice('--filter='.length);
const cache = new Map();
function sourceUrl(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) { return cache.get(filename); }
  let source = fs.readFileSync(filename, 'utf8');
  source = source.replace(/import Service, \{ service \} from '@ember\/service';/g, 'const Service = {extend: value => value}; const service = () => null;')
    .replace(/import Component from '@ember\/component';/g, 'const Component = {extend: value => value};')
    .replace(/import \{ service \} from '@ember\/service';/g, 'const service = () => null;')
    .replace(/import \{ computed \} from '@ember\/object';/g, 'const computed = (...args) => args.at(-1);')
    .replace(/import \{ get, computed \} from '@ember\/object';/g, 'const computed = (...args) => args.at(-1); const get = (row, key) => key.split(".").reduce((value, part) => value && value[part], row);')
    .replace(/import \{ reads \} from '@ember\/object\/computed';/g, 'const reads = () => null;')
    .replace(/import \{ observer \} from '@ember\/object';/g, 'const observer = (...args) => args.at(-1);')
    .replace(/import \{ scheduleOnce \} from '@ember\/runloop';/g, 'const scheduleOnce = (_queue, object, callback) => callback.call(object);')
    .replace(/import \{ alias \} from '@ember\/object\/computed';/g, 'const alias = () => null;')
    .replace(/import ModalBase from 'lacsso\/components\/modal-base';/g, 'const ModalBase = {extend: value => value};')
    .replace(/import config from 'ui\/config\/environment';/g, "const config = {APP: {webmcpMode: 'enabled'}};")
    .replace(/from '(ui\/[^']+|\.\.?\/[^']+)'/g, (whole, specifier) => {
      const resolved = specifier.startsWith('ui/') ? path.join(app, specifier.slice(3)) : path.resolve(path.dirname(filename), specifier);
      return `from '${sourceUrl(resolved.endsWith('.js') ? resolved : `${resolved}.js`)}'`;
    });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(filename, url);
  return url;
}
const get = function(key) { return key.split('.').reduce((value, part) => value && value[part], this); };
const set = function(key, value) { this[key] = value; };
const setProperties = function(values) { Object.assign(this, values); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };

async function main() {
  const {CommandContext} = await import(sourceUrl(path.join(app, 'utils/ai-command-context.js')));
  const {CommandEngine} = await import(sourceUrl(path.join(app, 'utils/ai-command-engine.js')));
  const {boundedCollaborationMode} = await import(sourceUrl(path.join(app, 'utils/ai-collaboration-controls.js')));
  const {default: serviceDefinition} = await import(sourceUrl(path.join(app, 'services/ai-command-service.js')));
  const {default: modalDefinition} = await import(sourceUrl(path.join(app, 'components/modal-ai-collaboration/component.js')));
  const {default: confirmationDefinition} = await import(sourceUrl(path.join(app, 'components/modal-confirm-ai-upgrade/component.js')));
  const {default: headerDefinition} = await import(sourceUrl(path.join(app, 'components/page-header-ai-control/component.js')));
  const {createCatalogHumanForm} = await import(sourceUrl(path.join(app, 'utils/ai-catalog-human-form.js')));
  const {default: selectDefinition} = await import(sourceUrl(path.join(app, 'components/new-select/component.js')));
  const plan = (suffix = '1') => ({id: `aiplan-${suffix.repeat(8)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(12)}`,
    serviceId: '1s1', serviceName: 'web', displayPath: 'Environment/Stack/web', currentImage: 'docker:app:1', requestedImage: 'docker:app:2',
    expiresAt: '2026-10-29T10:00:00Z', confirmationState: 'pending', status: 'preview'});
  const resourcePlan = (suffix = '1') => ({id: `aichange-${suffix.repeat(8)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(12)}`,
    resourceType: 'container', resourceId: '1i1', operation: 'stop', targetPath: 'Environment/Container/workload',
    changes: [{field: 'state', before: 'running', after: 'stopped'}], expiresAt: '2026-10-29T10:00:00Z', confirmationState: 'pending', status: 'preview'});
  const humanQuestion = {name:'password',type:'human',sourceType:'password',label:'Password',description:'Human input only',required:true,requiresHuman:true};
  const catalogPlan = () => ({id:'aicataloglaunch-11111111-1111-1111-1111-111111111111',status:'needs_user',confirmationState:'pending',inputsReady:false,
    summary:{stackName:'catalog-stack',templateKey:'database',templateName:'Database',catalogScope:'global',catalogId:'library',version:'1.0',revision:1,serviceCount:1,volumeCount:0,startsServices:true},
    changes:[{field:'name',before:null,after:'catalog-stack'},{field:'startOnCreate',before:null,after:true},{field:'serviceCount',before:null,after:1},{field:'volumeCount',before:null,after:0}],
    missingHumanInputs:[humanQuestion],expiresAt:'2026-10-30T12:00:00Z'});
  function fixture(mode = 'off') {
    const snapshot = {generation: 'generation-one', accountId: 'actor', projectId: 'project', projectName: 'Environment',
      schemaProjectId: 'project', schemaGeneration: 1, route: '/env/project/stacks'};
    let sequence = 0;
    const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode(mode);
    const requests = [];
    const service = Object.assign({}, serviceDefinition, {get, set, setProperties,
      commandContext: {context}, access: {ensureSession: async () => {}}, pendingPlan: null,
      userStore: {rawRequest: async options => { requests.push(options); return {body: {...plan(), confirmationState: 'approved'}}; }},
    });
    service.engine = new CommandEngine({context, request: async () => { throw new Error('Unexpected model command'); }, ensureSession: async () => {}});
    return {service, context, snapshot, requests};
  }
  let count = 0;
  async function test(name, body) {
    if (filter && !name.includes(filter)) { return; }
    await body(); count++; process.stdout.write(`PASS ${name}\n`);
  }

  await test('stale ordinary-link inbox warns blocks review and preserves exact-context cancellation only', async () => {
    const f = fixture(); let reviewed = 0; let cancelledContext; let toggled = 0;
    f.service.reviewInboxPlan = () => { reviewed++; return {status: 'needs_user'}; };
    const make = (extra = {}) => ({...resourcePlan('f'), resourceType: 'service', resourceId: '1s1', operation: 'update_links',
      changes: [{field: 'targetServices', before: '[]', after: '["Environment / Stack / target"]'}],
      confirmationState: 'approved', operationId: null, messageCode: 'ResourceChangePlanStale', ...extra});
    let serverPlan = make();
    const modal = Object.assign({}, modalDefinition, {get, set, setProperties, _loadGeneration: 0, commands: f.service,
      access: {ensureSession: async () => {}}, intl: {t: key => key}, modalService: {toggleModal() { toggled++; }},
      userStore: {rawRequest: async options => ({body: {data: options.url.includes('/aiResourceChangePlans') ? [serverPlan] : []}})}});
    await modal.loadPlans(); const stale = modal.plans[0];
    assert.equal(stale.staleLink, true); assert.equal(stale.canCancel, true);
    modalDefinition.actions.review.call(modal, stale); assert.equal(reviewed, 0); assert.equal(toggled, 0);
    modalDefinition.actions.requestCancel.call(modal, stale); assert.equal(modal.cancelCandidate, stale);
    f.service.cancelInboxPlan = async (plan, context) => { assert.equal(plan, stale); cancelledContext = context; return {status: 'succeeded', confirmationState: 'cancelled'}; };
    await modalDefinition.actions.cancelPlan.call(modal); assert.equal(cancelledContext, modal._loadedContext); assert.equal(modal.plans.length, 0);
    for (const extra of [{messageCode: 'OtherConflict'}, {messageCode: null},
      {resourceType: 'registry', resourceId: '1sp1', operation: 'stop', changes: [{field: 'state', before: 'active', after: 'inactive'}]}]) {
      serverPlan = make(extra); await modal.loadPlans(); assert.equal(modal.plans[0].staleLink, false);
      modalDefinition.actions.review.call(modal, modal.plans[0]);
    }
    assert.equal(reviewed, 3); assert.equal(toggled, 3);
    const template = fs.readFileSync(path.join(app, 'components/modal-ai-collaboration/template.hbs'), 'utf8');
    assert.match(template, /\{\{#if plan\.staleLink\}\}[\s\S]*?data-testid="ai-collaboration-stale-link"[\s\S]*?\{\{t "webmcp\.stale"\}\}/);
    assert.match(template, /disabled=\{\{plan\.staleLink\}\}[^{]*\{\{action "review" plan\}\}/);
    assert.match(template, /\{\{#if plan\.canCancel\}\}[\s\S]*?data-testid="ai-collaboration-cancel-plan"/);
  });

  await test('pending reminder mounts once in authenticated content under the original build ceiling and retains normal review', async () => {
    const Handlebars = require('handlebars').create();
    const {preprocess, traverse} = require('@glimmer/syntax');
    function assertNoScriptElement(html) {
      traverse(preprocess(html), {ElementNode(node) {
        assert.notEqual(node.tag.toLowerCase(), 'script', 'rendered reminder cannot contain a script element');
      }});
    }
    for (const html of ['<script></script>', '<ScRiPt></ScRiPt>', '<SCRIPT></SCRIPT>']) assert.throws(() => assertNoScriptElement(html), assert.AssertionError);
    const application = fs.readFileSync(path.join(app, 'application/template.hbs'), 'utf8');
    const authenticated = fs.readFileSync(path.join(app, 'authenticated/template.hbs'), 'utf8');
    const reminder = fs.readFileSync(path.join(app, 'components/ai-upgrade-review/template.hbs'), 'utf8');
    assert.equal((application.match(/\{\{ai-upgrade-review\}\}/g) || []).length, 0);
    assert.equal((authenticated.match(/\{\{ai-upgrade-review\}\}/g) || []).length, 1);
    assert.match(authenticated, /<main[^>]*>\s*\{\{#if this\.app\.webmcpAvailable\}\}\s*\{\{ai-upgrade-review\}\}\s*\{\{\/if\}\}/);
    const injection = fs.readFileSync(path.join(app, 'initializers/app.js'), 'utf8');
    assert.match(injection, /Controller\.reopen\(\{ app: ownerLookup\('application:main'\) \}\)/);
    let mounts = 0;
    Handlebars.registerHelper('t', key => key);
    Handlebars.registerHelper('action', () => '');
    Handlebars.registerHelper('and', (a, b) => a && b);
    for (const name of ['page-header', 'growl-mount', 'project-upgrade', 'console-workspace']) Handlebars.registerHelper(name, () => '');
    Handlebars.registerHelper('outlet', () => new Handlebars.SafeString('<section data-route-outlet></section>'));
    Handlebars.registerHelper('page-footer', () => new Handlebars.SafeString('<footer data-footer></footer>'));
    const renderReminder = Handlebars.compile(reminder);
    Handlebars.registerHelper('ai-upgrade-review', function() { mounts++; return new Handlebars.SafeString(renderReminder(this)); });
    const render = Handlebars.compile(authenticated);
    const pendingPlan = {planRef: 'same-plan', displayPath: 'Default / <ScRiPt>untrusted</sCrIpT>'};
    for (const [available, pending, notice] of [[false, pendingPlan, null], [true, null, null], [true, pendingPlan, null], [true, null, {code: 'ResourceChangeAuthorizationDenied'}]]) {
      mounts = 0;
      const html = render({app: {webmcpAvailable: available}, commands: {pendingPlan: pending, operationNotice: notice}});
      assert.equal(mounts, available ? 1 : 0);
      assert.equal(html.includes('data-testid="ai-upgrade-pending"'), !!(available && pending));
      assert.equal(html.includes('data-testid="ai-resource-authorization-denied"'), !!(available && notice));
      assertNoScriptElement(html);
      if (available && pending) {
        assert.ok(html.indexOf('data-testid="ai-upgrade-pending"') < html.indexOf('data-route-outlet'));
        assert.ok(html.includes('&lt;ScRiPt&gt;untrusted&lt;/sCrIpT&gt;'));
        assert.ok(html.indexOf('data-testid="ai-upgrade-review"') < html.indexOf('data-footer'));
      }
    }
    const {default: bridge} = await import(sourceUrl(path.join(app, 'components/ai-upgrade-review/component.js')));
    for (const destroyed of [false, true, false]) {
      const calls = [], context = {get, commands: {pendingPlan}, isDestroyed: destroyed,
        modalService: {modalVisible: false, toggleModal: (...args) => calls.push(args)}};
      context.openReview = () => bridge.openReview.call(context);
      bridge.actions.review.call(context);
      assert.equal(calls.length, destroyed ? 0 : 1, 'auth exit cannot open a stale review; re-entry can review the same pending plan');
      if (!destroyed) assert.deepEqual(calls[0], ['modal-confirm-ai-upgrade', {plan: pendingPlan}]);
    }
  });

  await test('mode controls cannot exceed the build ceiling', async () => {
    assert.equal(boundedCollaborationMode('off', 'enabled'), 'off');
    assert.equal(boundedCollaborationMode('read-only', 'enabled'), 'read-only');
    assert.equal(boundedCollaborationMode('enabled', 'off'), 'off');
    const modes = [];
    const modal = Object.assign({}, modalDefinition, {get, set, buildMode: 'read-only', registry: {setMode: async mode => modes.push(mode)}});
    await modal.actions.mode.call(modal, 'enabled');
    assert.deepEqual(modes, ['read-only']); assert.equal(modal.changing, false);
  });

  await test('human inbox approval works with off or read-only channels without native tools', async () => {
    for (const mode of ['off', 'read-only']) {
      const f = fixture(mode);
      assert.equal(f.service.reviewInboxPlan(plan()).status, 'needs_user');
      assert.ok(f.service.pendingPlan.planRef.startsWith('human_'));
      assert.notEqual(f.service.pendingPlan.planRef, plan().id);
      assert.equal(f.context.references.size, 0, 'human reference is separate from the native registry');
      const result = await f.service.confirmPendingPlan();
      assert.equal(result.confirmationState, 'approved'); assert.equal(f.context.mode, mode);
      assert.equal(f.requests.length, 1); assert.deepEqual(f.requests[0].data, {});
      assert.equal(f.requests[0].url, `projects/project/aiServiceUpgradePlans/${plan().id}?action=confirm`);
    }
    const f = fixture();
    assert.equal(f.service.reviewInboxPlan({...plan(), id: '../unexpected'}).code, 'INVALID_INPUT');
    assert.equal(f.service.pendingPlan, null); assert.equal(f.requests.length, 0);
  });

  await test('human confirmation checks the actor after authentication awaits', async () => {
    const f = fixture(), barrier = deferred();
    f.service.reviewInboxPlan(plan());
    f.service.access.ensureSession = () => barrier.promise;
    const pending = f.service.confirmPendingPlan();
    f.snapshot.generation = 'new-actor'; barrier.resolve();
    assert.equal((await pending).code, 'CONTEXT_CHANGED'); assert.equal(f.requests.length, 0);
  });

  await test('late human confirmation preserves a newer plan and does not restore dismissed plans', async () => {
    for (const scenario of ['newer', 'dismissed', 'matching']) {
      const f = fixture(), entered = deferred(), barrier = deferred();
      f.service.reviewInboxPlan(plan());
      const originalRef = f.service.pendingPlan.planRef;
      f.service.userStore.rawRequest = async options => { f.requests.push(options); entered.resolve(); await barrier.promise; return {body: {...plan(), confirmationState: 'approved'}}; };
      const pending = f.service.confirmPendingPlan(); await entered.promise;
      let expectedRef = originalRef;
      if (scenario === 'newer') { f.service.reviewInboxPlan(plan('2')); expectedRef = f.service.pendingPlan.planRef; }
      if (scenario === 'dismissed') { f.service.dismissPendingPlan(); expectedRef = null; }
      barrier.resolve(); assert.equal((await pending).status, 'succeeded');
      assert.equal(f.service.pendingPlan && f.service.pendingPlan.planRef, expectedRef);
    }
  });

  await test('header control is absent to off builds and preserves an existing modal', async () => {
    const calls = [];
    const header = Object.assign({}, headerDefinition, {get, app: {webmcpAvailable: false}, modalService: {modalVisible: false, toggleModal: (...args) => calls.push(args)}});
    header.actions.open.call(header); assert.equal(calls.length, 0);
    header.app.webmcpAvailable = true; header.modalService.modalVisible = true;
    header.actions.open.call(header); assert.equal(calls.length, 0);
    header.modalService.modalVisible = false; header.actions.open.call(header);
    assert.equal(calls[0][0], 'modal-ai-collaboration');
  });

  await test('inbox loads only on open or explicit refresh and drops results after close', async () => {
    const f = fixture(), requests = [], listeners = [];
    const modal = Object.assign({}, modalDefinition, {get, set, setProperties, _super() {}, commands: f.service, access: f.service.access,
      commandContext: {on: (...args) => listeners.push(args), off() {}},
      userStore: {rawRequest: async options => { requests.push(options); return {body: {type: 'collection', data: options.url.includes('aiServiceUpgradePlans') ? [plan()] : []}}; }},
    });
    modal.init(); assert.equal(requests.length, 0);
    await modal.didInsertElement(); assert.equal(requests.length, 3); assert.equal(modal.plans.length, 1);
    assert.equal(requests[0].url, 'projects/project/aiServiceUpgradePlans?limit=20');
    const entered = deferred(), barrier = deferred();
    modal.userStore.rawRequest = async options => { requests.push(options); entered.resolve(); await barrier.promise; return {body: {data: [plan('2')]}}; };
    const late = modal.actions.refresh.call(modal); await entered.promise;
    modal.isDestroying = true; modal.willDestroy(); barrier.resolve(); await late;
    assert.equal(modal.plans.length, 0); assert.equal(requests.length, 6);
  });

  await test('resource plans use human-only approval with off channels and preserve a newer pending plan', async () => {
    const f = fixture('off'), response = resourcePlan();
    f.service.userStore.rawRequest = async options => { f.requests.push(options); return {body: {...response, confirmationState: 'approved'}}; };
    assert.equal(f.service.reviewInboxPlan(response).status, 'needs_user');
    assert.equal(f.service.pendingPlan.planKind, 'resource-change');
    const approved = await f.service.confirmPendingPlan();
    assert.equal(approved.status, 'succeeded'); assert.equal(approved.confirmationState, 'approved');
    const confirmedModal={get,approved:false,plan:f.service.pendingPlan};
    assert.equal(confirmationDefinition.alreadyApproved.call(confirmedModal),true);
    assert.equal(f.requests[0].url, `projects/project/aiResourceChangePlans/${response.id}?action=confirm`);
    const entered = deferred(), barrier = deferred();
    f.service.userStore.rawRequest = async () => { entered.resolve(); await barrier.promise; return {body: {...response, confirmationState: 'approved'}}; };
    const late = f.service.confirmPendingPlan(); await entered.promise;
    f.service.reviewInboxPlan(resourcePlan('2')); const newer = f.service.pendingPlan.planRef;
    barrier.resolve(); await late; assert.equal(f.service.pendingPlan.planRef, newer);
    f.snapshot.accountId = 'another';
    assert.equal((await f.service.confirmPendingPlan()).code, 'CONTEXT_CHANGED');
  });

  await test('Stack lifecycle human inbox freezes all impact fields and checks the fresh plan before confirmation', async () => {
    const dto = {id: 'aichange-22222222-2222-2222-2222-222222222222', resourceType: 'stack', operation: 'cancel_upgrade',
      resourceId: 'stack-selected', targetPath: 'Environment/same', status: 'preview', confirmationState: 'pending', verifiedResult: false,
      changes: [{field: 'operation', before: null, after: 'cancel_upgrade'}, {field: 'state', before: 'upgrading', after: 'canceled-upgrade'},
        {field: 'affectedServiceCount', before: 2, after: 2}, {field: 'checkpointOnly', before: null, after: true}]};
    for (const scenario of ['matching', 'changed-count', 'changed-checkpoint', 'changed-response']) {
      const f = fixture('off');
      f.service.userStore.rawRequest = async options => {
        f.requests.push(options);
        const changed = JSON.parse(JSON.stringify(dto));
        if (scenario === 'changed-count' && options.method === 'GET' || scenario === 'changed-response' && options.method === 'POST') {
          changed.changes[2] = {field: 'affectedServiceCount', before: 3, after: 3};
        }
        if (scenario === 'changed-checkpoint' && options.method === 'GET') changed.changes[3].after = false;
        if (options.method === 'POST') changed.confirmationState = 'approved';
        return {body: changed};
      };
      assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
      const reviewed = f.service.pendingPlan;
      assert.equal(typeof reviewed.reviewSignature, 'string');
      const result = await f.service.confirmPendingPlan(reviewed);
      assert.equal(f.requests[0].method, 'GET');
      assert.equal(f.requests[0].url, 'projects/project/aiResourceChangePlans/' + dto.id);
      if (scenario === 'matching') {
        assert.equal(result.status, 'succeeded'); assert.equal(result.confirmationState, 'approved');
        assert.deepEqual(f.requests.map(row => row.method), ['GET', 'POST']);
      } else {
        assert.equal(result.code, scenario === 'changed-checkpoint' ? 'INVALID_RESPONSE' : 'CONFLICT');
        assert.equal(f.service.pendingPlan, reviewed);
        assert.equal(f.requests.filter(row => row.method === 'POST').length, scenario === 'changed-response' ? 1 : 0);
      }
      assert.equal(f.context.references.size, 0);
    }
  });

  await test('Registry removal human Cookie inbox rechecks the exact complete review before confirmation and pins its response', async () => {
    const dto = {id: 'aichange-33333333-3333-3333-3333-333333333333', resourceType: 'registry', resourceId: 'registry-selected',
      operation: 'remove', targetPath: 'Environment/registry.example:5000', status: 'preview', confirmationState: 'pending', verifiedResult: false,
      changes: [{field: 'state', before: 'inactive', after: 'removed'}, {field: 'affectedServiceCount', before: 0, after: 0},
        {field: 'affectedInstanceCount', before: 0, after: 0}, {field: 'affectedMountCount', before: 0, after: null},
        {field: 'mountedDataRule', before: null, after: 'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'},
        {field: 'affectedCredentialCount', before: 2, after: 2}]};
    for (const mode of ['off', 'read-only']) {
      for (const scenario of ['matching', 'changed-count', 'missing-count', 'missing-retention', 'changed-response', 'missing-response-count']) {
        const f = fixture(mode); let sessions = 0;
        f.service.access.ensureSession = async () => { sessions++; };
        f.service.userStore.rawRequest = async options => {
          f.requests.push(options);
          const body = JSON.parse(JSON.stringify(dto));
          if (scenario === 'changed-count' && options.method === 'GET' || scenario === 'changed-response' && options.method === 'POST') {
            body.changes[5] = {field: 'affectedCredentialCount', before: 3, after: 3};
          }
          if (scenario === 'missing-count' && options.method === 'GET' || scenario === 'missing-response-count' && options.method === 'POST') {
            body.changes = body.changes.filter(row => row.field !== 'affectedCredentialCount');
          }
          if (scenario === 'missing-retention' && options.method === 'GET') body.changes = body.changes.filter(row => row.field !== 'mountedDataRule');
          if (options.method === 'POST') body.confirmationState = 'approved';
          return {body};
        };
        assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
        const reviewed = f.service.pendingPlan;
        assert.equal(reviewed.humanOnly, true); assert.equal(typeof reviewed.reviewSignature, 'string');
        assert.equal(reviewed.displayDiff.find(row => row.field === 'affectedCredentialCount').before, 2);
        const result = await f.service.confirmPendingPlan(reviewed);
        assert.equal(sessions, 1); assert.equal(f.requests[0].method, 'GET');
        assert.equal(f.requests[0].url, 'projects/project/aiResourceChangePlans/' + dto.id);
        if (scenario === 'matching') {
          assert.equal(result.status, 'succeeded'); assert.equal(result.confirmationState, 'approved');
          assert.equal(f.service.pendingPlan.reviewSignature, reviewed.reviewSignature);
          assert.deepEqual(f.requests.map(row => row.method), ['GET', 'POST']);
          assert.equal(f.requests[1].url, 'projects/project/aiResourceChangePlans/' + dto.id + '?action=confirm');
          assert.deepEqual(f.requests[1].data, {});
        } else {
          assert.equal(result.code, scenario.startsWith('missing-') ? 'INVALID_RESPONSE' : 'CONFLICT');
          assert.equal(f.service.pendingPlan, reviewed); assert.equal(reviewed.confirmationState, 'pending');
          assert.equal(f.requests.filter(row => row.method === 'POST').length, scenario.endsWith('response') || scenario === 'missing-response-count' ? 1 : 0);
        }
        assert.equal(f.context.references.size, 0, 'human Cookie inbox must not issue or use model/Key references');
        assert.equal(f.requests.some(row => /action=apply|registry[Cc]redential|storage[Pp]ool/.test(row.url)), false);
      }
    }
  });

  await test('upgrade configuration human inbox freezes exact before-after and rejects a replaced review', async () => {
    const dto = {...plan(), requestedImage: 'docker:app:1', upgradeStrategy: {startFirst: false, batchSize: 1, intervalMillis: 2000},
      configurationChanges: [{field: 'ports', before: '["8080:80/tcp"]', after: '[]'}, {field: 'healthCheck', before: '{"port":80}', after: null}]};
    const f = fixture('off'); assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
    const reviewed = f.service.pendingPlan, modal = {get, plan: reviewed, commands: f.service};
    assert.ok(reviewed.reviewSignature); assert.ok(Object.isFrozen(reviewed.configurationChanges));
    assert.ok(Object.isFrozen(reviewed.configurationChanges[0]));
    const changed = structuredClone(dto); changed.configurationChanges[0].after = '["90/tcp"]';
    f.service.publishPlan({...reviewed, ...f.service.engine.planSummary(changed, reviewed.planRef)});
    assert.equal(confirmationDefinition.stale.call(modal), true);
    assert.equal((await f.service.confirmPendingPlan(reviewed)).code, 'CONFLICT'); assert.equal(f.requests.length, 0);
  });
  await test('upgrade configuration preview renders clear values and retains the human confirmation and apply owner', async () => {
    const f = fixture('enabled'), requests = [];
    let dto = {...plan(), requestedImage: 'docker:app:1', upgradeStrategy: {startFirst: false, batchSize: 1, intervalMillis: 2000},
      configurationChanges: [{field: 'ports', before: '["8080:80/tcp"]', after: '[]'}, {field: 'healthCheck', before: '{"port":80}', after: null}]};
    const transport = async options => {
      requests.push(options);
      if (options.url.endsWith('/aiServiceUpgradePlans')) return {body: structuredClone(dto)};
      if (options.url.endsWith('?action=confirm')) { dto = {...dto, confirmationState: 'approved'}; return {body: structuredClone(dto)}; }
      if (options.url.endsWith('?action=apply')) {
        assert.equal(dto.confirmationState, 'approved'); dto = {...dto, status: 'accepted'}; return {body: structuredClone(dto)};
      }
      if (options.url.endsWith('/' + dto.id)) return {body: {...structuredClone(dto), status: 'succeeded', verifiedResult: true}};
      throw Error('Unexpected config upgrade route');
    };
    f.service.engine = new CommandEngine({context: f.context, request: transport, ensureSession: async () => {}, wait: async () => {},
      audit: async () => ({accepted: true, requestId: 'config-audit'}), onPlan: (value, expected) => f.service.publishPlan(value, expected),
      onOperation: operation => f.service.clearCompletedPlan(operation)});
    const serviceRef = f.context.reference('service', {id: '1s1'}, f.context.capture());
    const preview = await f.service.execute('preview_service_upgrade', {serviceRef, ports: [], healthCheck: null});
    assert.equal(preview.status, 'needs_user'); assert.deepEqual(requests[0].data, {serviceId: '1s1', ports: [], healthCheck: null});
    const reviewed = f.service.pendingPlan, modal = {get, set, setProperties, commands: f.service, plan: reviewed,
      intl: {t: key => key}, approved: false, submitDisabled: false};
    const reviewLabels = confirmationDefinition.reviewLabels.call(modal);
    assert.equal(reviewLabels.upgradeConfigurationChanges.length, 2);
    const Handlebars = require('handlebars').create(), template = fs.readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8');
    require('@glimmer/syntax').preprocess(template);
    Handlebars.registerHelper('t', key => key); Handlebars.registerHelper('action', () => '');
    Handlebars.registerHelper('or', (left, right) => left || right); Handlebars.registerHelper('top-errors', () => '');
    const html = Handlebars.compile(template)({plan: reviewed, reviewLabels, isResourceChange: false});
    for (const field of ['ports','healthCheck']) assert.ok(html.includes('data-testid="ai-upgrade-config-' + field + '"'));
    assert.ok(html.includes('8080:80/tcp')); assert.ok(html.includes('[]')); assert.ok(html.includes('webmcp.nullValue'));
    await confirmationDefinition.actions.confirm.call(modal); assert.equal(modal.approved, true);
    const accepted = await f.service.execute('apply_service_upgrade', {planRef: preview.planRef}); assert.equal(accepted.status, 'accepted');
    const complete = await f.service.execute('get_operation', {operationRef: accepted.operationRef}); assert.equal(complete.verifiedResult, true);
    assert.equal(f.service.pendingPlan, null); assert.equal(requests.filter(row => row.url.endsWith('?action=apply')).length, 1);
    assert.deepEqual(requests.find(row => row.url.endsWith('?action=apply')).data, {});
  });

  await test('Volume create human inbox renders the logical-only warning and binds every reviewed value', async () => {
    const dto = {...resourcePlan(), resourceType: 'volume', operation: 'create', resourceId: null, targetPath: 'Env / new-data', changes: [
      {field:'name', before:null, after:'new-data'}, {field:'driver', before:null, after:'local'}, {field:'state', before:null, after:'inactive'}]};
    const f = fixture('off'); assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
    const reviewed = f.service.pendingPlan, modal = {get, set, setProperties, commands:f.service, plan:reviewed,
      intl:{t:key=>key}, approved:false, submitDisabled:false};
    assert.ok(reviewed.reviewSignature);
    const reviewLabels = confirmationDefinition.reviewLabels.call(modal); assert.equal(reviewLabels.localVolumeCreateNotice,'webmcp.localVolumeCreateNotice');
    const Handlebars = require('handlebars').create(), template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
    require('@glimmer/syntax').preprocess(template); Handlebars.registerHelper('t',key=>key); Handlebars.registerHelper('action',()=> '');
    Handlebars.registerHelper('or',(left,right)=>left||right); Handlebars.registerHelper('top-errors',()=> '');
    const html=Handlebars.compile(template)({plan:reviewed,reviewLabels,isResourceChange:true});
    assert.ok(html.includes('data-testid="ai-volume-create-logical-only"')); assert.ok(html.includes('formVolumes.volumeDriver.local'));
    const changed=structuredClone(dto); changed.changes[0].after='old-same-name';
    f.service.publishPlan({...reviewed,...f.service.engine.planSummary(changed,reviewed.planRef)});
    assert.equal(confirmationDefinition.stale.call(modal),true); assert.equal((await f.service.confirmPendingPlan(reviewed)).code,'CONFLICT');
    assert.equal(f.requests.length,0);
  });

  await test('upgrade strategy human inbox binds every effective value to the exact immutable review', async () => {
    const dto = {...plan(), upgradeStrategy: {startFirst: true, batchSize: 2, intervalMillis: 1500}};
    for (const field of ['startFirst', 'batchSize', 'intervalMillis', 'requestedImage', 'displayPath']) {
      const f = fixture('off'); assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
      const reviewed = f.service.pendingPlan, modal = {get, plan: reviewed, commands: f.service};
      assert.ok(reviewed.reviewSignature); assert.equal(Object.isFrozen(reviewed.upgradeStrategy), true);
      const changed = structuredClone(dto);
      if (field === 'requestedImage') changed.requestedImage = 'docker:app:3';
      else if (field === 'displayPath') changed.displayPath = 'Environment/OtherStack/web';
      else changed.upgradeStrategy[field] = field === 'startFirst' ? false : changed.upgradeStrategy[field] + 1;
      f.service.publishPlan({...reviewed, ...f.service.engine.planSummary(changed, reviewed.planRef)});
      assert.equal(confirmationDefinition.stale.call(modal), true);
      assert.equal((await f.service.confirmPendingPlan(reviewed)).code, 'CONFLICT'); assert.equal(f.requests.length, 0);
      f.service.reviewInboxPlan(dto);
      const original = f.service.pendingPlan;
      f.service.userStore.rawRequest = async options => { f.requests.push(options); return {body: {...changed, confirmationState: 'approved'}}; };
      assert.equal((await f.service.confirmPendingPlan(original)).code, 'CONFLICT');
      assert.equal(f.service.pendingPlan.confirmationState, 'pending');
    }
  });

  await test('upgrade strategy preview review modal human confirmation apply and verified operation share exact values', async () => {
    const f = fixture('enabled'), strategy = {startFirst: true, batchSize: 2, intervalMillis: 1500}, requests = [];
    let dto = {...plan(), upgradeStrategy: strategy};
    const transport = async options => {
      requests.push(options);
      if (options.url.endsWith('/aiServiceUpgradePlans')) return {body: structuredClone(dto)};
      if (options.url.endsWith('?action=confirm')) { dto = {...dto, confirmationState: 'approved'}; return {body: structuredClone(dto)}; }
      if (options.url.endsWith('?action=apply')) {
        assert.equal(dto.confirmationState, 'approved'); dto = {...dto, status: 'accepted'}; return {body: structuredClone(dto)};
      }
      if (options.url.endsWith('/' + dto.id)) return {body: {...structuredClone(dto), status: 'succeeded', verifiedResult: true}};
      throw Error('Unexpected upgrade strategy route');
    };
    f.service.engine = new CommandEngine({context: f.context, request: transport, ensureSession: async () => {}, wait: async () => {},
      audit: async () => ({accepted: true, requestId: 'strategy-audit'}), onPlan: (value, expected) => f.service.publishPlan(value, expected),
      onOperation: operation => f.service.clearCompletedPlan(operation)});
    const serviceRef = f.context.reference('service', {id: '1s1'}, f.context.capture());
    const preview = await f.service.execute('preview_service_upgrade', {serviceRef, image: 'app:2', ...strategy});
    assert.equal(preview.status, 'needs_user'); assert.deepEqual(requests[0].data, {serviceId: '1s1', image: 'app:2', ...strategy});
    const reviewed = f.service.pendingPlan, modal = {get, set, setProperties, commands: f.service, plan: reviewed,
      intl: {t: key => key}, approved: false, submitDisabled: false};
    const reviewLabels = confirmationDefinition.reviewLabels.call(modal);
    assert.deepEqual(reviewLabels.upgradeStrategyChanges.map(row => row.after), ['generic.yess', '2', '1500 formHealthCheck.interval.unit']);
    const Handlebars = require('handlebars').create(), template = fs.readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8');
    require('@glimmer/syntax').preprocess(template);
    Handlebars.registerHelper('t', key => key); Handlebars.registerHelper('action', () => '');
    Handlebars.registerHelper('or', (left, right) => left || right); Handlebars.registerHelper('top-errors', () => '');
    const html = Handlebars.compile(template)({plan: reviewed, reviewLabels, isResourceChange: false});
    for (const field of ['startFirst', 'batchSize', 'intervalMillis']) assert.ok(html.includes('data-testid="ai-upgrade-strategy-' + field + '"'));
    assert.ok(html.includes('1500 formHealthCheck.interval.unit'));
    await confirmationDefinition.actions.confirm.call(modal); assert.equal(modal.approved, true);
    assert.deepEqual(f.service.pendingPlan.upgradeStrategy, strategy);
    const accepted = await f.service.execute('apply_service_upgrade', {planRef: preview.planRef}); assert.equal(accepted.status, 'accepted');
    const complete = await f.service.execute('get_operation', {operationRef: accepted.operationRef});
    assert.equal(complete.status, 'succeeded'); assert.equal(complete.verifiedResult, true);
    assert.deepEqual(reviewed.upgradeStrategy, strategy); assert.equal(f.service.pendingPlan, null);
    assert.equal(requests.filter(row => row.url.endsWith('?action=apply')).length, 1);
    assert.deepEqual(requests.find(row => row.url.endsWith('?action=apply')).data, {});
  });

  function stackReviewFixture(rows = [], lookup = async () => { throw Error('Unexpected Stack lookup'); }, resourceType = 'service') {
    const f = fixture('off'), dto = {...resourcePlan(), resourceType, resourceId: null, operation: 'create',
      targetPath: 'Environment / path / contains / slashes / app', stackName: 'model-supplied-label',
      changes: [{field: 'name', before: null, after: 'app'}, {field: 'stackId', before: null, after: '1st42'}]};
    assert.equal(f.service.reviewInboxPlan(dto).status, 'needs_user');
    const calls = [], record = row => ({get: key => row[key]});
    // store.all returns an Ember ArrayProxy, not an iterable or numerically indexed array.
    const collection = {
      get length() { return rows.length; },
      objectAt(index) { return rows[index] && record(rows[index]); },
      map(callback) {
        const result = [];
        for (let index = 0; index < this.length; index++) result.push(callback(this.objectAt(index), index, this));
        return result;
      },
    };
    const modal = {get, set, setProperties, commands: f.service, plan: f.service.pendingPlan, intl: {t: key => key},
      loadingReviewStack: false, reviewStackRecord: null, errors: null, approved: false, stale: false,
      store: {all(type) { assert.equal(type, 'stack'); return collection; },
        find(...args) { calls.push(args); return lookup(...args); }}, loadReviewStack: confirmationDefinition.loadReviewStack};
    Object.defineProperties(modal, {
      reviewStacks: {get() { return confirmationDefinition.reviewStacks.call(this); }},
      reviewLabels: {get() { return confirmationDefinition.reviewLabels.call(this); }},
      submitDisabled: {get() { return Boolean(confirmationDefinition.submitDisabled.call(this)); }},
    });
    return {f, dto, modal, calls, record, collection};
  }

  await test('create review stack identity supports noniterable Ember ArrayProxy records in warm and cold caches', async () => {
    const exact = {id: '1st42', accountId: 'project', name: 'Real Stack'};
    const warm = stackReviewFixture([exact]);
    assert.equal(warm.collection.length, 1); assert.equal(warm.collection.objectAt(0).get('id'), exact.id);
    assert.equal(warm.collection[0], undefined); assert.equal(warm.collection[Symbol.iterator], undefined);
    assert.deepEqual(Array.from(warm.collection), [undefined], 'The fixture must expose Array.from misuse');
    assert.equal(warm.modal.reviewLabels.displayChanges[1].after, exact.name);
    assert.equal(warm.modal.submitDisabled, false); await warm.modal.loadReviewStack(); assert.equal(warm.calls.length, 0);
    const cold = stackReviewFixture([{...exact, id: '1st41'}], async () => cold.record(exact));
    assert.equal(cold.modal.submitDisabled, true); await cold.modal.loadReviewStack();
    assert.equal(cold.modal.reviewLabels.displayChanges[1].after, exact.name); assert.equal(cold.modal.submitDisabled, false);
    assert.deepEqual(cold.calls, [['stack', '1st42', {forceReload: true}]]);
  });

  await test('create review stack identity uses exact loaded names and existing translations without parsing target paths', async () => {
    const YAML = require('yamljs'), name = 'Same / <script>Stack</script>';
    for (const resourceType of ['service', 'container']) {
      const x = stackReviewFixture([{id: '1st41', accountId: 'project', name},
        {id: '1st42', accountId: 'foreign', name: 'FOREIGN_SECRET'}, {id: '1st42', accountId: 'project', name}], undefined, resourceType);
      const original = JSON.stringify(x.modal.plan);
      for (const locale of ['en-us','zh-tw','zh-hans','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua']) {
        const translations = YAML.load(path.join(app, '../translations', locale + '.yaml'));
        const t = key => { const value = key.split('.').reduce((row, part) => row && row[part], translations); assert.equal(typeof value, 'string', locale + ': ' + key); return value; };
        x.modal.intl = {t};
        assert.equal(x.modal.reviewLabels.displayChanges.find(row => row.field === 'stackId').after, name);
        assert.equal(x.modal.reviewLabels.displayChanges.find(row => row.field === 'stackId').fieldLabel, t('apiKeyAccess.selector.types.stack'));
        for (const key of ['generic.loading', 'generic.unknown', 'action.retry', 'webmcp.failed']) assert.ok(t(key));
      }
      assert.equal(x.modal.submitDisabled, false); await x.modal.loadReviewStack(); assert.equal(x.calls.length, 0);
      const Handlebars = require('handlebars').create(), template = fs.readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8');
      require('@glimmer/syntax').preprocess(template);
      Handlebars.registerHelper('t', key => key); Handlebars.registerHelper('action', () => '');
      Handlebars.registerHelper('or', (left, right) => left || right); Handlebars.registerHelper('top-errors', () => '');
      const html = Handlebars.compile(template)({plan: x.modal.plan, reviewLabels: x.modal.reviewLabels, isResourceChange: true});
      assert.ok(html.includes('Same / &lt;script&gt;Stack&lt;/script&gt;'));
      for (const value of ['1st42', '1st41', 'FOREIGN_SECRET', 'model-supplied-label', '<script>']) assert.ok(!html.includes(value), value);
      assert.equal(JSON.stringify(x.modal.plan), original);
      x.f.service.userStore.rawRequest = async options => { x.f.requests.push(options); return {body: {...x.dto, confirmationState: 'approved'}}; };
      await confirmationDefinition.actions.confirm.call(x.modal);
      assert.equal(x.modal.approved, true); assert.equal(x.f.requests.length, 1); assert.deepEqual(x.f.requests[0].data, {});
      assert.ok(x.f.requests[0].url.endsWith('/' + x.dto.id + '?action=confirm'));
    }
  });

  await test('create review stack identity loads cache misses normally and retains the plan through errors and retry', async () => {
    const exact = {id: '1st42', accountId: 'project', name: 'Real / Stack'};
    const cold = stackReviewFixture([], async () => cold.record(exact));
    const original = cold.modal.plan;
    assert.equal(cold.modal.submitDisabled, true);
    assert.equal(cold.modal.reviewLabels.displayChanges[1].after, 'generic.unknown');
    let initialLoad;
    cold.modal.loadReviewStack = () => { initialLoad = confirmationDefinition.loadReviewStack.call(cold.modal); return initialLoad; };
    cold.modal._super = () => {}; cold.modal.element = {querySelector: () => null}; cold.modal.loadHumanInputs = () => {};
    confirmationDefinition.didInsertElement.call(cold.modal);
    assert.equal(cold.modal.loadingReviewStack, true);
    await confirmationDefinition.actions.confirm.call(cold.modal); assert.equal(cold.f.requests.length, 0);
    await initialLoad;
    assert.deepEqual(cold.calls, [['stack', '1st42', {forceReload: true}]]);
    assert.equal(cold.modal.reviewLabels.displayChanges[1].after, exact.name); assert.equal(cold.modal.submitDisabled, false);
    assert.equal(cold.modal.plan, original); assert.equal(cold.f.service.pendingPlan, original); assert.equal(cold.f.requests.length, 0);
    let attempts = 0;
    const retry = stackReviewFixture([], async () => {
      if (++attempts === 1) throw Object.assign(Error('PRIVATE_RAW_1st42'), {status: 403});
      return retry.record(exact);
    });
    await retry.modal.loadReviewStack();
    assert.deepEqual(retry.modal.errors, ['webmcp.failed']); assert.equal(retry.modal.submitDisabled, true);
    assert.equal(retry.modal.plan, retry.f.service.pendingPlan); assert.equal(retry.f.context.snapshot().accountId, 'actor');
    await confirmationDefinition.actions.retryReviewStack.call(retry.modal);
    assert.equal(retry.calls.length, 2); assert.equal(retry.modal.errors, null); assert.equal(retry.modal.submitDisabled, false);
    for (const bad of [{...exact, id: '1st43'}, {...exact, accountId: 'foreign'}, {...exact, removed: 'now'}, {...exact, name: ''}]) {
      const x = stackReviewFixture([bad], async () => x.record(bad));
      await x.modal.loadReviewStack();
      assert.equal(x.modal.reviewLabels.stackTargetUnavailable, true); assert.equal(x.modal.submitDisabled, true);
      assert.equal(x.modal.reviewLabels.displayChanges[1].after, 'generic.unknown');
      assert.deepEqual(x.modal.errors, ['webmcp.failed']);
      await confirmationDefinition.actions.confirm.call(x.modal); assert.equal(x.f.requests.length, 0);
      assert.equal(x.modal.plan, x.f.service.pendingPlan);
    }
    const duplicate = stackReviewFixture([exact, {...exact, name: 'Ambiguous'}], async () => duplicate.record(exact));
    assert.equal(duplicate.modal.submitDisabled, true); await duplicate.modal.loadReviewStack();
    assert.equal(duplicate.modal.reviewLabels.displayChanges[1].after, exact.name); assert.equal(duplicate.modal.submitDisabled, false);
  });

  await test('create review stack identity ignores late results after context session plan or modal changes', async () => {
    for (const scenario of ['generation', 'actor', 'project', 'new-plan', 'same-id-replacement', 'dismissed', 'destroyed']) {
      const reply = deferred(), x = stackReviewFixture([], () => reply.promise), original = x.modal.plan;
      const loading = x.modal.loadReviewStack(); assert.equal(x.modal.loadingReviewStack, true);
      await x.modal.loadReviewStack(); assert.equal(x.calls.length, 1, 'No duplicate concurrent lookup');
      if (scenario === 'generation') x.f.snapshot.generation = 'generation-two';
      if (scenario === 'actor') x.f.snapshot.accountId = 'another-actor';
      if (scenario === 'project') x.f.snapshot.projectId = x.f.snapshot.schemaProjectId = 'other-project';
      if (scenario === 'new-plan') x.f.service.reviewInboxPlan(resourcePlan('2'));
      if (scenario === 'same-id-replacement') x.f.service.reviewInboxPlan(x.dto);
      if (scenario === 'dismissed') x.f.service.dismissPendingPlan();
      if (scenario === 'destroyed') x.modal.isDestroyed = true;
      reply.resolve(x.record({id: '1st42', accountId: 'project', name: 'LATE_PRIVATE_STACK'})); await loading;
      assert.equal(x.modal.reviewStackRecord, null, scenario); assert.equal(x.modal.plan, original);
      assert.ok(!JSON.stringify(x.modal.reviewLabels).includes('LATE_PRIVATE_STACK'), scenario);
      assert.equal(x.f.requests.length, 0); assert.equal(x.modal.approved, false);
    }
  });

  await test('service create review binds ports and healthCheck to the exact human confirmation', async () => {
    const dto = {...resourcePlan(), resourceType: 'service', resourceId: null, operation: 'create', changes: [
      {field: 'ports', before: null, after: '["8080:80/tcp"]'},
      {field: 'healthCheck', before: null, after: '{"port":80,"interval":2000,"strategy":"recreate"}'},
    ]};
    for (const field of ['ports', 'healthCheck']) {
      const f = fixture('off'); f.service.reviewInboxPlan(dto);
      const reviewed = f.service.pendingPlan;
      const modal = {get, plan: reviewed, commands: f.service};
      assert.equal(confirmationDefinition.stale.call(modal), false);
      const changed = structuredClone(dto);
      changed.changes.find(item => item.field === field).after = field === 'ports' ? '["8081:80/tcp"]' : '{"port":81,"interval":2000,"strategy":"recreate"}';
      f.service.publishPlan({...reviewed, ...f.service.engine.planSummary(changed, reviewed.planRef)});
      assert.equal(confirmationDefinition.stale.call(modal), true);
      assert.equal((await f.service.confirmPendingPlan(reviewed)).code, 'CONFLICT'); assert.equal(f.requests.length, 0);
      f.service.reviewInboxPlan(dto);
      const original = f.service.pendingPlan;
      f.service.userStore.rawRequest = async options => { f.requests.push(options); return {body: {...changed, confirmationState: 'approved'}}; };
      assert.equal((await f.service.confirmPendingPlan(original)).code, 'CONFLICT');
      assert.equal(f.service.pendingPlan.confirmationState, 'pending'); assert.equal(f.requests.length, 1);
    }
  });

  await test('service create verified receipt reaches the live confirmation modal and ignores stale completions', async () => {
    for (const scenario of ['complete', 'context-changed', 'newer-plan']) {
      const f = fixture('enabled'), entered = deferred(), barrier = deferred(), requests = [];
      let dto = {...resourcePlan(), resourceType: 'service', resourceId: null, operation: 'create', changes: [
        {field: 'name', before: null, after: 'web'}, {field: 'ports', before: null, after: '["80/tcp"]'},
        {field: 'healthCheck', before: null, after: '{"port":80,"strategy":"recreate"}'},
      ]};
      const transport = async request => {
        requests.push(request);
        if (request.url === 'projects/project/aiResourceChangePlans') return {body: structuredClone(dto)};
        if (request.url.endsWith('?action=confirm')) { dto = {...dto, confirmationState: 'approved'}; return {body: structuredClone(dto)}; }
        if (request.url.endsWith('?action=apply')) {
          assert.equal(dto.confirmationState, 'approved'); dto = {...dto, status: 'accepted'}; return {body: structuredClone(dto)};
        }
        if (request.url.endsWith('/' + dto.id)) {
          entered.resolve(); await barrier.promise;
          return {body: {...structuredClone(dto), status: 'succeeded', verifiedResult: true, executionResult: {assignedPorts: ['32768:80/tcp']}}};
        }
        throw Error('Unexpected service-create receipt route');
      };
      f.service.engine = new CommandEngine({context: f.context, request: transport, ensureSession: async () => {}, wait: async () => {},
        audit: async () => ({accepted: true, requestId: 'receipt-audit'}), onPlan: (plan, expected) => f.service.publishPlan(plan, expected),
        onOperation: operation => f.service.clearCompletedPlan(operation)});
      const parentRef = f.context.reference('resource', {id: 'stack', family: 'stack', resourceType: 'stack', scope: 'project'}, f.context.capture());
      const preview = await f.service.execute('preview_resource_change', {resourceType: 'service', operation: 'create', parentRef,
        parameters: {name: 'web', image: 'nginx:1.28', ports: ['80/tcp'], healthCheck: {port: 80}}});
      assert.equal(preview.status, 'needs_user');
      const originalDiff = structuredClone(f.service.pendingPlan.displayDiff);
      const modal = {get, setProperties, commands: f.service, intl: {t: key => key}, approved: false, submitDisabled: false,
        modalService: {modalOpts: {plan: f.service.pendingPlan}}, clearHumanInputs() {},
        get plan() { return this.modalService.modalOpts.plan; },
        set(key, value) { if (key === 'modalService.modalOpts.plan') this.modalService.modalOpts.plan = value; else this[key] = value; },
      };
      await confirmationDefinition.actions.confirm.call(modal);
      assert.equal(modal.approved, true); assert.equal(f.service.pendingPlan.confirmationState, 'approved');
      const accepted = await f.service.execute('apply_resource_change', {planRef: preview.planRef});
      assert.equal(accepted.status, 'accepted');
      const pending = f.service.execute('get_operation', {operationRef: accepted.operationRef}); await entered.promise;
      if (scenario === 'context-changed') f.snapshot.generation = 'replacement-session';
      if (scenario === 'newer-plan') f.service.reviewInboxPlan(resourcePlan('2'));
      const beforeCompletion = f.service.pendingPlan;
      barrier.resolve(); const completed = await pending;
      confirmationDefinition.pendingChanged.call(modal);
      if (scenario === 'complete') {
        assert.equal(completed.status, 'succeeded'); assert.equal(completed.verifiedResult, true);
        assert.equal(f.service.pendingPlan.planRef, preview.planRef); assert.equal(f.service.pendingPlan.confirmationState, 'approved');
        assert.deepEqual(f.service.pendingPlan.displayDiff, originalDiff); assert.notEqual(f.service.pendingPlan, beforeCompletion);
        assert.equal(modal.modalService.modalOpts.plan, f.service.pendingPlan);
        const reviewLabels = confirmationDefinition.reviewLabels.call(modal);
        assert.equal(reviewLabels.executionAssignedPorts, '["32768:80/tcp"]');
        const Handlebars = require('handlebars').create();
        Handlebars.registerHelper('t', key => key); Handlebars.registerHelper('action', () => '');
        Handlebars.registerHelper('or', (left, right) => left || right); Handlebars.registerHelper('top-errors', () => '');
        const html = Handlebars.compile(fs.readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8'))({
          plan: modal.plan, reviewLabels, isResourceChange: true, isCatalogLaunch: false, alreadyApproved: true, submitDisabled: true,
        });
        assert.match(html, /<section data-testid="ai-resource-execution-result">/); assert.match(html, /32768:80\/tcp/);
      } else {
        assert.equal(completed.code, scenario === 'context-changed' ? 'CONTEXT_CHANGED' : undefined);
        const staleSummary = f.service.engine.resourcePlanSummary({...dto, status: 'succeeded', verifiedResult: true, executionResult: {assignedPorts: ['32768:80/tcp']}}, null);
        f.service.clearCompletedPlan({planId: dto.id, status: 'succeeded', planSummary: staleSummary});
        assert.equal(f.service.pendingPlan, beforeCompletion); assert.equal(f.service.pendingPlan.executionResult, undefined);
        assert.equal(modal.modalService.modalOpts.plan.executionResult, undefined);
        assert.equal(confirmationDefinition.reviewLabels.call(modal).executionAssignedPorts, null);
      }
      assert.equal(requests.filter(request => request.url.endsWith('?action=apply')).length, 1);
    }
  });

  await test('resource plan inbox joins both typed collections without exposing raw payload fields', async () => {
    const f = fixture('off'), requests = [];
    const modal = Object.assign({}, modalDefinition, {get, set, setProperties, _super() {}, commands: f.service, access: f.service.access,
      intl: {t: key => key}, modalService: {toggleModal() {}},
      commandContext: {on() {}, off() {}},
      userStore: {rawRequest: async options => { requests.push(options); return {body: {data: options.url.includes('aiResourceChangePlans') ? [{...resourcePlan(), snapshot: 'SECRET_SENTINEL'}] : options.url.includes('aiServiceUpgradePlans') ? [plan()] : []}}; }},
    });
    modal.init(); await modal.didInsertElement();
    assert.equal(requests.length, 3); assert.equal(modal.plans.length, 2);
    assert.equal(modal.plans[1].planKind, 'resource-change');
    assert.equal(modal.plans[1].displayPath, 'Environment/Container/workload');
    assert.equal(JSON.stringify(modal.plans).includes('SECRET_SENTINEL'), false);
    assert.deepEqual(modal.plans[1].changes, resourcePlan().changes);
    assert.equal(modal.plans[1].targetPath, resourcePlan().targetPath);
    modal.actions.review.call(modal, modal.plans[1]);
    assert.equal(modal.loadError, false);
    assert.equal(f.service.pendingPlan.serverPlanId, resourcePlan().id);
    assert.equal(f.service.pendingPlan.planKind, 'resource-change');
    const confirmTemplate = fs.readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8');
    assert.ok(confirmTemplate.includes('this.isResourceChange'));
    assert.ok(confirmTemplate.includes('this.reviewLabels.displayChanges'));
    assert.ok(confirmTemplate.includes('{{change.fieldLabel}}'));
    const strategyTestId = 'data-testid="ai-upgrade-strategy-{{change.field}}"';
    assert.equal(confirmTemplate.split(strategyTestId).length, 2);
    const configurationTestId = 'data-testid="ai-upgrade-config-{{change.field}}"';
  assert.equal(confirmTemplate.split(configurationTestId).length, 2);
  const assertNoRawField = template => assert.ok(!template.replace(strategyTestId, '').replace(configurationTestId, '').includes('{{change.field}}'));
    assertNoRawField(confirmTemplate);
    assert.throws(() => assertNoRawField(confirmTemplate + '<dt>{{change.field}}</dt>'), assert.AssertionError);
    assert.throws(() => assertNoRawField(confirmTemplate + '<dd title="{{change.field}}">label</dd>'), assert.AssertionError);
    assert.ok(confirmTemplate.includes('<pre class="ai-resource-diff-value">{{change.before}}</pre>'));
    assert.ok(confirmTemplate.includes('<pre class="ai-resource-diff-value">{{change.after}}</pre>'));
    assert.ok(!confirmTemplate.includes('{{{'));
  });

  await test('Catalog human inbox joins safe plans and reports an unavailable collection without hiding authorized plans', async () => {
    const f=fixture('off'), dto=catalogPlan(), requests=[];
    const modal=Object.assign({},modalDefinition,{get,set,setProperties,_super(){},commands:f.service,access:f.service.access,intl:{t:key=>key},
      commandContext:{on(){},off(){}},modalService:{toggleModal(){}},userStore:{rawRequest:async options=>{
        requests.push(options);
        if(options.url.includes('aiResourceChangePlans'))throw {status:403};
        return {body:{data:options.url.includes('aiCatalogStackLaunchPlans')?[{...dto,snapshot:'PRIVATE_SENTINEL',missingHumanInputs:[{...humanQuestion,default:'PRIVATE_SENTINEL'}]}]:[plan()]}};
      }}});
    modal.init();await modal.didInsertElement();
    assert.equal(requests.length,3);assert.equal(modal.plans.length,2);assert.equal(modal.loadError,false);assert.equal(modal.partialLoadError,true);
    const row=modal.plans[1];assert.equal(row.planKind,'catalog-launch');assert.equal(row.operation,'create_from_catalog');assert.equal(row.canCancel,true);
    assert.equal(JSON.stringify(modal.plans).includes('PRIVATE_SENTINEL'),false);
    modal.actions.review.call(modal,row);assert.equal(f.service.pendingPlan.serverPlanId,dto.id);assert.equal(f.service.pendingPlan.inputsReady,false);
  });

  await test('Catalog human form keeps values only in its closure and uses closed input components', async () => {
    const definition=(name,type,sourceType=type)=>({name,type,sourceType,label:name,description:'',required:true,requiresHuman:true,...(type==='reference'?{referenceType:sourceType}:{})});
    const form=createCatalogHumanForm([humanQuestion,definition('enabled','boolean'),definition('count','int'),definition('existing','reference','secret'),
      definition('private_choice','enum')],{secret:[{value:'permitted-secret-id',label:'Secret name'}]});
    form.fields[0].value='PRIVATE_FORM_SENTINEL';form.fields[1].value=false;form.fields[2].value='0';form.fields[3].value='permitted-secret-id';form.fields[4].value='human choice';
    assert.equal(JSON.stringify(form).includes('PRIVATE_FORM_SENTINEL'),false);assert.equal(Object.keys(form.fields[0]).includes('value'),false);
    assert.equal(form.fields[4].inputComponent,'schema/input-string');
    assert.deepEqual(JSON.parse(JSON.stringify(form.payload())),{answers:{password:'PRIVATE_FORM_SENTINEL',enabled:false,count:0,private_choice:'human choice'},referenceBindings:{existing:'permitted-secret-id'}});
    form.fields[3].value='unlisted-id';assert.throws(()=>form.payload(),/INVALID_INPUT/);
    form.clear();assert.equal(form.fields[0].value,undefined);assert.throws(()=>form.payload(),/INVALID_INPUT/);
    const unknown=createCatalogHumanForm([definition('custom','human','https://untrusted/component')]);assert.equal(unknown.fields[0].inputComponent,'schema/input-string');
  });

  await test('Catalog human completion and approval work with tools off without retaining answers', async () => {
    const f=fixture('off'),dto=catalogPlan();let ready=false;
    f.service.userStore.rawRequest=async options=>{
      f.requests.push(options);
      if(options.url.endsWith('?action=completeInputs')){ready=true;return {body:{...dto,inputsReady:true,missingHumanInputs:[]}};}
      if(options.url.endsWith('?action=confirm'))return {body:{...dto,inputsReady:ready,missingHumanInputs:[],confirmationState:'approved'}};
      return {body:{...dto,missingHumanInputs:[{...humanQuestion,default:'DEFAULT_MUST_NOT_LEAVE'}]}};
    };
    assert.equal(f.service.reviewInboxPlan(dto).status,'needs_user');const pending=f.service.pendingPlan;
    const metadata=await f.service.catalogHumanForm(pending);assert.equal(JSON.stringify(metadata).includes('DEFAULT_MUST_NOT_LEAVE'),false);
    const completed=await f.service.completeCatalogHumanInputs(pending,{answers:{password:'PRIVATE_ANSWER'},referenceBindings:{}});
    assert.equal(completed.status,'succeeded');assert.equal(f.service.pendingPlan.inputsReady,true);assert.equal(f.service.pendingPlan.confirmationState,'pending');
    assert.equal(JSON.stringify({pending:f.service.pendingPlan,refs:[...f.context.references.values()]}).includes('PRIVATE_ANSWER'),false);
    assert.equal((await f.service.confirmPendingPlan()).confirmationState,'approved');assert.equal(f.context.mode,'off');
    assert.equal(f.requests[1].url,`projects/project/aiCatalogStackLaunchPlans/${dto.id}?action=completeInputs`);
    const disabled={get,plan:{inputsReady:false,planStatus:'needs_user'},isCatalogLaunch:true};assert.equal(confirmationDefinition.submitDisabled.call(disabled),true);
  });

  await test('Catalog reference prompt prevents native select render from silently choosing the first resource',async()=>{
    const question={name:'existing',type:'reference',sourceType:'service',referenceType:'service',label:'Service',description:'',required:true,requiresHuman:true};
    const form=createCatalogHumanForm([question],{service:[{value:'first-id',label:'Stack A/web'},{value:'second-id',label:'Stack B/web'}]}),field=form.fields[0];
    assert.equal(field.referencePromptKey,'schema.inputService.prompt');
    const content=field.choices;content.filterBy=(key,value)=>content.filter(item=>item[key]===value);
    const dom={options:[{value:'Choose a Service...'},...content.map(item=>({value:item.value}))],selectedIndex:0,value:'Choose a Service...'};
    const select={get,content,optionValuePath:'value',value:undefined,$:()=>[dom],_change:selectDefinition._change,
      set(key,value){this[key]=value;if(key==='value')field.value=value;}};
    selectDefinition.didRender.call(select);assert.equal(field.value,null);assert.throws(()=>form.payload(),/INVALID_INPUT/);
    dom.selectedIndex=2;dom.value='second-id';selectDefinition._change.call(select);
    assert.deepEqual(JSON.parse(JSON.stringify(form.payload())),{answers:{},referenceBindings:{existing:'second-id'}});
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
    assert.ok(template.includes('prompt=question.referencePromptKey'));
  });

  await test('Catalog reference choices require distinguishable names and never accept disabled ambiguous targets',async()=>{
    const question={name:'existing',type:'reference',sourceType:'service',referenceType:'service',label:'Service',description:'',required:true,requiresHuman:true};
    const choices=[{value:'first',label:'web'},{value:'second',label:'web'},{value:'third',label:'Visible Stack/web'}];
    const form=createCatalogHumanForm([question],{service:choices}),field=form.fields[0];
    assert.equal(field.hasAmbiguousChoices,true);assert.deepEqual(field.choices.map(choice=>!!choice.disabled),[true,true,false]);
    assert.equal(choices[0].disabled,undefined);field.value='first';assert.throws(()=>form.payload(),/INVALID_INPUT/);
    field.value='third';assert.equal(form.payload().referenceBindings.existing,'third');
    for(const type of ['service','certificate','secret']){
      const typed=createCatalogHumanForm([{...question,referenceType:type,sourceType:type}],{}).fields[0];assert.ok(typed.referencePromptKey);
    }
  });

  await test('Catalog optional human empty values are explicit and never fall back to a private default', async()=>{
    const optional={...humanQuestion,required:false,default:'PRIVATE_DEFAULT'};
    const reference={name:'optionalReference',type:'reference',sourceType:'secret',referenceType:'secret',label:'Secret',description:'',required:false,requiresHuman:true};
    const form=createCatalogHumanForm([optional,reference],{},'None');
    assert.deepEqual(JSON.parse(JSON.stringify(form.payload())),{answers:{},referenceBindings:{}});
    form.fields[0].value='';form.fields[1].value='';
    assert.deepEqual(JSON.parse(JSON.stringify(form.payload())),{answers:{password:''},referenceBindings:{optionalReference:''}});
    assert.equal(form.fields[1].choices[0].label,'None');assert.equal(JSON.stringify(form).includes('PRIVATE_DEFAULT'),false);
    form.fields[0].value='  ';assert.equal(form.payload().answers.password,'  ');
    form.clear();assert.equal(Object.hasOwn(form.payload().answers,'password'),false);
  });

  await test('Catalog supported workflow joins named lookup version questions human approval apply and verified receipt',async()=>{
    const f=fixture('enabled'),tpl='ctm-'+'a'.repeat(64),other='ctm-'+'b'.repeat(64),ver='cvm-'+'c'.repeat(64),requests=[],audits=[];
    let dto=catalogPlan(),applies=0;
    const transport=async request=>{
      requests.push(request);
      if(request.url.endsWith('/aiCatalogMetadataViews')){
        const version={id:ver,type:'catalogTemplateVersion',templateId:tpl,version:'1.0',revision:1};
        return {body:request.data.versions?{resourceType:'catalogTemplateVersion',data:[version]}:{resourceType:'catalogTemplate',data:[
          {id:tpl,type:'catalogTemplate',name:'Database',templateKey:'database',catalogId:'library',catalogScope:'global',templateBase:''},
          {id:other,type:'catalogTemplate',name:'Database',templateKey:'demo',catalogId:'library',catalogScope:'global',templateBase:''}]}};
      }
      if(request.url.endsWith('/aiCatalogStackLaunchOptions'))return {body:{optionsRef:'acopts-22222222-2222-2222-2222-222222222222',launchEnabled:true,
        requiredOperations:['read','create','update'],questions:[humanQuestion]}};
      if(request.url.endsWith('/aiCatalogStackLaunchPlans'))return {body:structuredClone(dto)};
      if(request.url.endsWith('?action=completeInputs')){
        assert.deepEqual(JSON.parse(JSON.stringify(request.data)),{answers:{password:'PRIVATE_TYPED'},referenceBindings:{}});
        dto={...dto,inputsReady:true,missingHumanInputs:[]};return {body:structuredClone(dto)};
      }
      if(request.url.endsWith('?action=confirm')){dto={...dto,confirmationState:'approved'};return {body:structuredClone(dto)};}
      if(request.url.endsWith('?action=apply')){applies++;assert.equal(dto.confirmationState,'approved');dto={...dto,status:'accepted',operationId:dto.id};return {body:structuredClone(dto)};}
      if(request.url.endsWith('/'+dto.id))return {body:structuredClone(dto.status==='accepted'?{...dto,status:'succeeded',verifiedResult:true,
        createdResource:{resourceType:'stack',id:'new-stack',name:dto.summary.stackName}}:dto)};
      throw Error('Unexpected supported workflow route');
    };
    f.service.userStore.rawRequest=transport;
    f.service.engine=new CommandEngine({context:f.context,request:transport,ensureSession:async()=>{},wait:async()=>{},
      audit:async event=>{audits.push(event);return {accepted:true,requestId:'audit-'+audits.length};},
      onPlan:(plan,expected)=>f.service.publishPlan(plan,expected),onOperation:operation=>f.service.clearCompletedPlan(operation)});
    const engine=f.service.engine;
    const found=await engine.execute('find_resources',{family:'catalog',query:'Database'});assert.equal(found.items.length,2);assert.equal(f.service.pendingPlan,null);
    const picked=found.items.find(row=>row.fields.templateKey==='database');
    const versions=await engine.execute('find_resources',{family:'catalog',resourceType:'catalogTemplateVersion',parentRef:picked.resourceRef});
    const selected=await engine.execute('get_resource',{resourceRef:versions.items[0].resourceRef});assert.equal(selected.launchOptions.questions[0].requiresHuman,true);
    const preview=await engine.execute('preview_resource_change',{resourceType:'stack',operation:'create_from_catalog',catalogVersionRef:versions.items[0].resourceRef,
      parameters:{name:'catalog-stack',startOnCreate:true,answers:[]}});assert.equal(preview.status,'needs_user');
    f.service.reviewInboxPlan(dto);const human=f.service.pendingPlan;const formData=await f.service.catalogHumanForm(human);
    const form=createCatalogHumanForm(formData.questions);form.fields[0].value='PRIVATE_TYPED';
    assert.equal((await f.service.completeCatalogHumanInputs(human,form.payload())).inputsReady,true);form.clear();
    assert.equal((await f.service.confirmPendingPlan()).confirmationState,'approved');
    const accepted=await engine.execute('apply_resource_change',{planRef:preview.planRef});assert.equal(accepted.status,'accepted');
    assert.equal(f.service.pendingPlan.planStatus,'accepted');assert.equal(f.service.pendingPlan.confirmationState,'approved');
    const completed=await engine.execute('get_operation',{operationRef:accepted.operationRef});
    assert.equal(completed.status,'succeeded');assert.equal(completed.verifiedResult,true);assert.ok(completed.createdResource.resourceRef);
    assert.equal(f.service.pendingPlan,null);assert.equal(applies,1);
    assert.equal(JSON.stringify({found,selected,preview,accepted,completed,audits,refs:[...f.context.references.values()]}).includes('PRIVATE_TYPED'),false);
    assert.equal(requests.filter(request=>request.url.endsWith('?action=confirm')).length,1);
  });

  await test('Catalog cancellation is human only and preserves newer plans or a changed actor',async()=>{
    const f=fixture('off'),dto=catalogPlan(),entered=deferred(),barrier=deferred();f.service.reviewInboxPlan(dto);
    f.service.userStore.rawRequest=async request=>{f.requests.push(request);entered.resolve();await barrier.promise;
      return {body:{...dto,status:'cancelled',confirmationState:'cancelled'}};};
    const pending=f.service.cancelInboxPlan(dto,f.service.captureReviewContext());await entered.promise;
    const newerDto={...dto,id:dto.id.replaceAll('1','2')};f.service.reviewInboxPlan(newerDto);const newer=f.service.pendingPlan;
    barrier.resolve();assert.equal((await pending).status,'succeeded');assert.equal(f.service.pendingPlan,newer);
    assert.equal(f.requests[0].url,`projects/project/aiCatalogStackLaunchPlans/${dto.id}?action=cancel`);
    assert.deepEqual(f.requests[0].data,{});
    assert.equal(f.service.canCancelInboxPlan({...dto,status:'accepted',operationId:dto.id}),false);
    const changed=fixture('off'),session=deferred();changed.service.reviewInboxPlan(dto);changed.service.access.ensureSession=()=>session.promise;
    const cancelled=changed.service.cancelInboxPlan(dto,changed.service.captureReviewContext());changed.snapshot.accountId='other';session.resolve();
    assert.equal((await cancelled).code,'CONTEXT_CHANGED');assert.equal(changed.requests.length,0);
  });

  await test('Catalog observed operation state updates only its own review and never labels accepted work unapplied',async()=>{
    const f=fixture('off'),dto={...catalogPlan(),inputsReady:true,missingHumanInputs:[],confirmationState:'approved'};f.service.reviewInboxPlan(dto);
    f.service.engine.onOperation=operation=>f.service.clearCompletedPlan(operation);
    const original=f.service.pendingPlan,modal={get,plan:original,commands:f.service,
      set(key,value){assert.equal(key,'modalService.modalOpts.plan');this.plan=value;},clearHumanInputs(){this.cleared=true;}};
    f.service.engine.operationSummary({...dto,status:'accepted'},'unused-operation');
    confirmationDefinition.pendingChanged.call(modal);assert.equal(modal.plan.planStatus,'accepted');
    assert.equal(confirmationDefinition.catalogAfterPreview.call({...modal,isCatalogLaunch:true}),true);
    f.service.clearCompletedPlan({planId:dto.id,status:'unknown'});confirmationDefinition.pendingChanged.call(modal);
    assert.equal(modal.plan.planStatus,'unknown');assert.equal(modal.plan.verifiedResult,false);
    assert.equal(confirmationDefinition.catalogAfterPreview.call({...modal,isCatalogLaunch:true}),true);
    const newer={...catalogPlan(),id:dto.id.replaceAll('1','2')};f.service.reviewInboxPlan(newer);const pending=f.service.pendingPlan;
    f.service.engine.operationSummary({...dto,status:'failed',reason:'CatalogLaunchSourceChanged'},'unused-operation');
    assert.equal(f.service.pendingPlan,pending);confirmationDefinition.pendingChanged.call(modal);assert.equal(modal.cleared,true);
  });

  await test('background authorization failure clears only its matching approved plan and shows a safe notice', async () => {
    const f = fixture('off'), dto = {...resourcePlan(), confirmationState: 'approved'};
    f.service.reviewInboxPlan(dto);
    f.service.engine.onOperation = operation => f.service.clearCompletedPlan(operation);
    const result = f.service.engine.operationSummary({...dto, status: 'failed', verifiedResult: false,
      messageCode: 'ResourceChangeAuthorizationDenied', exception: 'PRIVATE_PROCESS_DATA'}, 'existing-operation');
    assert.equal(result.status, 'failed'); assert.equal(result.operationRef, 'existing-operation');
    assert.equal(f.service.pendingPlan, null);
    assert.deepEqual(f.service.operationNotice, {code: 'ResourceChangeAuthorizationDenied'});
    assert.equal(JSON.stringify(f.service.operationNotice).includes('PRIVATE_PROCESS_DATA'), false);
    const template = fs.readFileSync(path.join(app, 'components/ai-upgrade-review/template.hbs'), 'utf8');
    const notice = template.match(/<div[^>]*data-testid="ai-resource-authorization-denied"[^>]*>(.*?)<\/div>/s);
    assert.ok(notice); assert.match(notice[0], /role="alert"/);
    assert.match(notice[1], /t "webmcp.backgroundAuthorizationDenied"/); assert.doesNotMatch(notice[1], /action|button|htmlSafe|\{\{\{/);
    f.service.reviewInboxPlan(resourcePlan('2'));
    assert.equal(f.service.operationNotice, null, 'a new plan clears the previous operation notice');
    f.service.operationNotice = {code: 'ResourceChangeAuthorizationDenied'};
    f.service.dismissPendingPlan(); assert.equal(f.service.operationNotice, null); assert.equal(f.service.pendingPlan, null);
  });

  await test('background authorization failure from an old plan or actor cannot clear a new plan or publish a notice', async () => {
    for (const scenario of ['newer', 'context-changed']) {
      const f = fixture('off'), dto = {...resourcePlan(), confirmationState: 'approved'};
      f.service.reviewInboxPlan(dto);
      if (scenario === 'newer') f.service.reviewInboxPlan(resourcePlan('2'));
      else f.snapshot.generation = 'different-actor-generation';
      const pending = f.service.pendingPlan;
      f.service.clearCompletedPlan({planId: dto.id, status: 'failed', messageCode: 'ResourceChangeAuthorizationDenied'});
      assert.equal(f.service.pendingPlan, pending); assert.equal(f.service.operationNotice, null);
    }
    const f = fixture('off'); f.service.reviewInboxPlan({...resourcePlan(), confirmationState: 'approved'});
    f.service.clearCompletedPlan({planId: resourcePlan().id, status: 'unknown', messageCode: 'ResourceChangeAuthorizationDenied'});
    assert.ok(f.service.pendingPlan); assert.equal(f.service.operationNotice, null, 'unknown is not a verified authorization failure');
  });


  await test('operation outcome: native failure stays visible while AUTH and verified success retain their behavior', async () => {
    const f = fixture('enabled'), dto = {...resourcePlan(), confirmationState: 'approved'};
    f.service.reviewInboxPlan(dto); const reviewed = f.service.pendingPlan;
    f.service.engine.onOperation = operation => f.service.clearCompletedPlan(operation);
    f.service.engine.operationSummary({...dto, status: 'failed', verifiedResult: false, messageCode: 'ResourceChangeProcessFailed', exception: 'PRIVATE_PROCESS_DATA'}, 'existing-operation');
    assert.equal(f.service.pendingPlan, null);
    assert.deepEqual(f.service.operationNotice, {code: 'OPERATION_FAILED', failed: true});
    assert.equal(JSON.stringify(f.service.operationNotice).includes('PRIVATE_PROCESS_DATA'), false);
    const notice = f.service.operationNotice;
    f.service.clearCompletedPlan({planId:dto.id,status:'failed'});
    assert.equal(f.service.operationNotice, notice, 'duplicate polls do not republish a notice');
    assert.equal((await f.service.confirmPendingPlan(reviewed)).code, 'STALE_REFERENCE');
    assert.equal(f.requests.length, 0, 'a retry needs a fresh preview and human approval, never another automatic POST');
    f.service.reviewInboxPlan(dto);
    f.service.engine.operationSummary({...dto,status:'failed',messageCode:'ResourceChangeAuthorizationDenied'},'existing-operation');
    assert.deepEqual(f.service.operationNotice,{code:'ResourceChangeAuthorizationDenied'});
    f.service.reviewInboxPlan(dto);
    f.service.engine.operationSummary({...dto,status:'succeeded',verifiedResult:true},'existing-operation');
    assert.equal(f.service.pendingPlan,null);assert.equal(f.service.operationNotice,null);
  });

  await test('operation outcome: unverified results bind the exact operation and ignore replaced, dismissed or stale reviews', async () => {
    for (const scenario of ['matching','newer','dismissed','generation','other-operation','new-notice']) {
      const f=fixture('enabled'),dto={...resourcePlan(),confirmationState:'approved'};
      f.service.reviewInboxPlan(dto);const original=f.service.pendingPlan;
      const ref=f.context.reference('operation',{id:scenario==='other-operation'?resourcePlan('3').id:dto.id},f.context.capture());
      const entered=deferred(),barrier=deferred();
      f.service.engine.execute=async()=>{entered.resolve();await barrier.promise;return f.service.engine.operationSummary({...dto,status:'succeeded',verifiedResult:false},ref);};
      const pending=f.service.execute('get_operation',{operationRef:ref});await entered.promise;
      if(scenario==='newer')f.service.reviewInboxPlan(resourcePlan('2'));
      if(scenario==='dismissed')f.service.dismissPendingPlan();
      if(scenario==='generation')f.snapshot.generation='new-generation';
      if(scenario==='new-notice')f.service.clearCompletedPlan({planId:dto.id,status:'failed',messageCode:'ResourceChangeAuthorizationDenied'});
      const current=f.service.pendingPlan,currentNotice=f.service.operationNotice;barrier.resolve();const result=await pending;assert.equal(result.status,'unknown');
      if(scenario==='matching'){
        assert.equal(f.service.pendingPlan,null);assert.deepEqual(f.service.operationNotice,{code:'UNKNOWN_RESULT',unknown:true});
        const notice=f.service.operationNotice;await f.service.execute('get_operation',{operationRef:ref});assert.equal(f.service.operationNotice,notice);
        assert.equal((await f.service.confirmPendingPlan(original)).code,'STALE_REFERENCE');
      }else{assert.equal(f.service.pendingPlan,current);assert.equal(f.service.operationNotice,currentNotice,'an older result cannot overwrite a newer notice');}
      assert.equal(f.requests.length,0);
    }
    for(const scenario of ['newer','generation']){
      const f=fixture('enabled'),dto={...resourcePlan(),confirmationState:'approved'};f.service.reviewInboxPlan(dto);
      if(scenario==='newer')f.service.reviewInboxPlan(resourcePlan('2'));else f.snapshot.generation='changed';
      const current=f.service.pendingPlan,notice={code:'UNKNOWN_RESULT',unknown:true};f.service.operationNotice=notice;
      f.service.clearCompletedPlan({planId:dto.id,status:'failed'});assert.equal(f.service.pendingPlan,current);assert.equal(f.service.operationNotice,notice);
    }
  });


  await test('operation outcome: concurrent terminal callbacks retain the exact caller review even when its plan ID is reused', async () => {
    for(const status of ['failed','succeeded','authorization-denied'])for(const scenario of ['same-id-review','current','new-notice','generation']){
      const f=fixture('enabled'),dto={...resourcePlan(),confirmationState:'approved'},entered=deferred(),barrier=deferred();
      const wireStatus=status==='authorization-denied'?'failed':status;
      f.service.reviewInboxPlan(dto);let defaultObserverCalls=0;
      f.service.engine=new CommandEngine({context:f.context,ensureSession:async()=>{},
        audit:async()=>({accepted:true,requestId:'review-race-audit'}),
        request:async options=>{f.requests.push(options);entered.resolve();await barrier.promise;return{body:{...dto,status:wireStatus,verifiedResult:status==='succeeded',...(status==='authorization-denied'?{messageCode:'ResourceChangeAuthorizationDenied'}:{})}};},
        onOperation:operation=>{defaultObserverCalls++;f.service.clearCompletedPlan(operation);}});
      const observer=f.service.engine.onOperation;
      const op=f.context.reference('operation',{id:dto.id,planKind:'resource-change',resourceType:dto.resourceType,operation:dto.operation,resourceId:dto.resourceId},f.context.capture());
      const running=f.service.execute('get_operation',{operationRef:op});await entered.promise;
      if(scenario==='same-id-review')f.service.reviewInboxPlan(dto);
      if(scenario==='new-notice')f.service.operationNotice={code:'UNKNOWN_RESULT',unknown:true};
      if(scenario==='generation')f.snapshot.generation='replacement-generation';
      const current=f.service.pendingPlan,notice=f.service.operationNotice;barrier.resolve();const result=await running;
      if(scenario==='current'){
        assert.equal(result.status,wireStatus);assert.equal(f.service.pendingPlan,null);
        assert.deepEqual(f.service.operationNotice,status==='authorization-denied'?{code:'ResourceChangeAuthorizationDenied'}:status==='failed'?{code:'OPERATION_FAILED',failed:true}:null);
        const once=f.service.operationNotice;await f.service.execute('get_operation',{operationRef:op});assert.equal(f.service.operationNotice,once,'duplicate terminal polls do not publish a new notice');
      }else{
        assert.equal(f.service.pendingPlan,current,scenario+': old terminal callback cannot clear a same-ID replacement review');
        assert.equal(f.service.operationNotice,notice,scenario+': old terminal callback cannot replace a newer notice');
      }
      assert.equal(f.service.engine.onOperation,observer,'no invocation mutates the shared observer');
      assert.equal(defaultObserverCalls,0,'this Web invocation uses only its private observer');
      assert.ok(f.requests.every(row=>row.method==='GET'),'terminal observation never applies or confirms');
    }
    // Two truly concurrent polls receive independent observers. The later
    // completed failure must not be erased by an earlier delayed success.
    const f=fixture('enabled'),dto={...resourcePlan(),confirmationState:'approved'},barriers=[deferred(),deferred()],entered=[deferred(),deferred()];
    f.service.reviewInboxPlan(dto);let calls=0;
    f.service.engine=new CommandEngine({context:f.context,ensureSession:async()=>{},audit:async()=>({accepted:true,requestId:'parallel-audit'}),
      request:async()=>{const n=calls++;entered[n].resolve();await barriers[n].promise;return{body:{...dto,status:n===0?'succeeded':'failed',verifiedResult:n===0}};},
      onOperation:operation=>f.service.clearCompletedPlan(operation)});
    const op=f.context.reference('operation',{id:dto.id,planKind:'resource-change',resourceType:dto.resourceType,operation:dto.operation,resourceId:dto.resourceId},f.context.capture());
    const first=f.service.execute('get_operation',{operationRef:op});await entered[0].promise;
    const second=f.service.execute('get_operation',{operationRef:op});await entered[1].promise;
    barriers[1].resolve();await second;const notice=f.service.operationNotice;assert.equal(notice.code,'OPERATION_FAILED');
    barriers[0].resolve();await first;assert.equal(f.service.operationNotice,notice);assert.equal(f.service.pendingPlan,null);
  });

  await test('operation outcome: the original alert renders thirteen translated safe notices without an apply action', async () => {
    const YAML=require('yamljs'),Handlebars=require('handlebars').create(),{preprocess,traverse}=require('@glimmer/syntax');
    const template=fs.readFileSync(path.join(app,'components/ai-upgrade-review/template.hbs'),'utf8');preprocess(template);
    Handlebars.registerHelper('t',function(key){return key.split('.').reduce((row,part)=>row&&row[part],this.translations);});
    Handlebars.registerHelper('action',()=> '');const render=Handlebars.compile(template);
    const locales=['en-us','zh-tw','zh-hans','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua'];
    const seen=new Set();
    for(const locale of locales){
      const translations=YAML.load(path.join(app,'../translations',locale+'.yaml'));
      for(const [notice,key,testId]of [[{code:'OPERATION_FAILED',failed:true},'operationFailed','ai-resource-operation-failed'],
        [{code:'UNKNOWN_RESULT',unknown:true},'operationUnknown','ai-resource-operation-unknown'],
        [{code:'ResourceChangeAuthorizationDenied'},'backgroundAuthorizationDenied','ai-resource-authorization-denied']]){
        const text=translations.webmcp[key];assert.equal(typeof text,'string',locale+': '+key);assert.ok(text.trim());
        if(key!=='backgroundAuthorizationDenied')seen.add(text);
        const elements=[];traverse(preprocess(render({commands:{operationNotice:notice,pendingPlan:null},translations})),{ElementNode(node){elements.push(node);}});
        const attr=(node,name)=>node.attributes.find(row=>row.name===name)?.value.chars;
        const alert=elements.find(node=>attr(node,'data-testid')===testId);assert.ok(alert);assert.equal(attr(alert,'role'),'alert');
        assert.equal(alert.children.map(node=>node.chars||'').join(''),text);
        assert.equal(elements.filter(node=>['button','a','input','script'].includes(node.tag)).length,0);
        assert.equal(elements.filter(node=>attr(node,'role')==='alert').length,1);
      }
    }
    assert.equal(seen.size,26,'new notices are genuine translations, not an English fallback');
    const traditional=YAML.load(path.join(app,'../translations/zh-tw.yaml')).webmcp;
    assert.match(traditional.operationFailed,/部分變更可能已完成/);assert.match(traditional.operationUnknown,/不要重新送出/);
  });

  await test('combined preflight notice does not claim an approved Archive or Catalog plan is still unapplied',async()=>{
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
    assert.ok(template.includes('{{#unless (or this.catalogAfterPreview this.alreadyApproved this.isBrowserEnvironment)}}'));
    for(const planKind of ['resource-change','catalog-launch','browser-environment']){
      const modal={get,approved:false,isCatalogLaunch:planKind==='catalog-launch',plan:{planKind,operation:planKind==='catalog-launch'?'create_from_catalog':'archive',
        confirmationState:'approved',planStatus:planKind==='catalog-launch'?'needs_user':undefined}};
      const approved=confirmationDefinition.alreadyApproved.call(modal),after=confirmationDefinition.catalogAfterPreview.call(modal);
      const browser=confirmationDefinition.isBrowserEnvironment.call(modal);
      assert.equal(approved,true);assert.equal(!(after||approved||browser),false);
      modal.plan.confirmationState='pending';assert.equal(confirmationDefinition.alreadyApproved.call(modal),false);
      assert.equal(!(after||browser),planKind!=='browser-environment','only Browser intents omit the native mutation notice while pending');
    }
  });

  await test('Catalog malformed human input success remains uncertain and never resubmits private answers',async()=>{
    const f=fixture('off'),dto=catalogPlan();f.service.reviewInboxPlan(dto);let calls=0;
    f.service.userStore.rawRequest=async()=>{calls++;return {body:{id:dto.id,private:'PRIVATE_WRITE'}};};
    const original=f.service.pendingPlan,result=await f.service.completeCatalogHumanInputs(original,{answers:{password:'PRIVATE_WRITE'},referenceBindings:{}});
    assert.equal(result.status,'unknown');assert.equal(calls,1);assert.equal(f.service.pendingPlan,original);
    assert.equal(JSON.stringify(result).includes('PRIVATE_WRITE'),false);assert.equal(JSON.stringify(original).includes('PRIVATE_WRITE'),false);
  });

  await test('Catalog human numeric inputs preserve false zero and finite owner-safe values',async()=>{
    const question={name:'amount',type:'float',sourceType:'float',label:'Amount',description:'',required:true,requiresHuman:true};
    const form=createCatalogHumanForm([question]);form.fields[0].value='0';assert.equal(form.payload().answers.amount,0);
    form.fields[0].value='0.5';assert.equal(form.payload().answers.amount,.5);
    for(const value of ['9007199254740992','1e309']){form.fields[0].value=value;assert.throws(()=>form.payload(),/INVALID_INPUT/);}
  });

  await test('Catalog review distinguishes exact scope catalog template and revision without raw enums or HTML',async()=>{
    const dto=catalogPlan(),first={get,plan:{catalogSummary:dto.summary},intl:{t:key=>'localized:'+key}};
    const a=confirmationDefinition.catalogIdentityLabels.call(first);
    const second={...first,plan:{catalogSummary:{...dto.summary,catalogScope:'project',catalogId:'team',revision:2}}};
    const b=confirmationDefinition.catalogIdentityLabels.call(second);
    assert.notEqual(a.source,b.source);assert.match(a.source,/localized:apiKeyAccess.scopes.global \/ library \/ database/);
    assert.equal(a.version,'1.0 (r1)');assert.equal(b.version,'1.0 (r2)');
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
    assert.ok(template.includes('{{this.catalogIdentityLabels.source}}'));assert.ok(template.includes('{{this.catalogIdentityLabels.version}}'));
    assert.ok(template.includes('{{this.plan.context.projectName}}'));assert.ok(!template.includes('{{{'));
  });

  await test('Catalog late or uncertain human input submission never replaces a newer plan or retries', async () => {
    for(const scenario of ['newer','actor','lost']){
      const f=fixture('off'),dto=catalogPlan(),entered=deferred(),barrier=deferred();f.service.reviewInboxPlan(dto);const pending=f.service.pendingPlan;
      f.service.userStore.rawRequest=async options=>{f.requests.push(options);entered.resolve();await barrier.promise;if(scenario==='lost')throw Error('PRIVATE_ERROR');return {body:{...dto,inputsReady:true,missingHumanInputs:[]}};};
      const write=f.service.completeCatalogHumanInputs(pending,{answers:{password:'PRIVATE_ANSWER'},referenceBindings:{}});await entered.promise;
      if(scenario==='newer')f.service.reviewInboxPlan(plan());if(scenario==='actor')f.snapshot.accountId='changed';
      const current=f.service.pendingPlan;barrier.resolve();const result=await write;
      assert.equal(result.status,'unknown');assert.equal(result.code,'UNKNOWN_RESULT');assert.equal(f.service.pendingPlan,current);assert.equal(f.requests.length,1);
      assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
    }
    const f=fixture('off'),barrier=deferred();f.service.reviewInboxPlan(catalogPlan());f.service.access.ensureSession=()=>barrier.promise;
    const before=f.service.completeCatalogHumanInputs(f.service.pendingPlan,{answers:{},referenceBindings:{}});f.snapshot.generation='replacement';barrier.resolve();
    assert.equal((await before).code,'CONTEXT_CHANGED');assert.equal(f.requests.length,0);
  });

  await test('Catalog modal clears private human inputs after uncertain submission or dismissal', async () => {
    const dto=catalogPlan(),f=fixture('off');f.service.reviewInboxPlan(dto);
    const modal=Object.assign({},confirmationDefinition,{get,set,setProperties,plan:f.service.pendingPlan,commands:f.service,intl:{t:key=>key},stale:false,
      modalService:{modalOpts:{plan:f.service.pendingPlan},toggleModal(){}},_super(){}});
    f.service.catalogHumanForm=async()=>({questions:[humanQuestion],referenceChoices:{}});
    let calls=0;f.service.completeCatalogHumanInputs=async(_plan,inputs)=>{calls++;assert.equal(inputs.answers.password,'PRIVATE_FORM');return {status:'unknown'};};
    await modal.loadHumanInputs();modal.humanQuestions[0].value='PRIVATE_FORM';await modal.actions.completeInputs.call(modal);
    assert.equal(calls,1);assert.deepEqual(modal.humanQuestions,[]);assert.deepEqual(modal.errors,['webmcp.catalogInputUnknown']);
    await modal.loadHumanInputs();const field=modal.humanQuestions[0];field.value='PRIVATE_FORM';modal.actions.cancel.call(modal);assert.equal(field.value,undefined);
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');
    assert.ok(template.includes('component question.inputComponent'));assert.ok(template.includes('{{question.label}}'));assert.ok(!template.includes('{{{'));
  });

  await test('Catalog successful partial completion reloads only the remaining safe human fields',async()=>{
    const dto=catalogPlan(),f=fixture('off');f.service.reviewInboxPlan(dto);let reads=0;
    const modal=Object.assign({},confirmationDefinition,{get,set,setProperties,plan:f.service.pendingPlan,commands:f.service,intl:{t:key=>key},stale:false,
      modalService:{modalOpts:{plan:f.service.pendingPlan}},_super(){}});
    f.service.catalogHumanForm=async()=>{reads++;return {questions:[{...humanQuestion,required:false}],referenceChoices:{}};};
    f.service.completeCatalogHumanInputs=async()=>({status:'succeeded'});
    await modal.loadHumanInputs();modal.humanQuestions[0].value='';await modal.actions.completeInputs.call(modal);
    assert.equal(reads,2);assert.equal(modal.humanQuestions.length,1);assert.equal(modal.humanQuestions[0].value,undefined);
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');assert.ok(template.includes('action (fn (mut question.value) "")'));
  });

  await test('Catalog safe form refresh adopts ready or expired state and drops late reads from another plan',async()=>{
    for(const ready of [true,false]){
      const dto=catalogPlan(),f=fixture('off');f.service.reviewInboxPlan(dto);
      f.service.userStore.rawRequest=async options=>{f.requests.push(options);return {body:{...dto,status:ready?'needs_user':'failed',inputsReady:ready,missingHumanInputs:ready?[]:[humanQuestion]}};};
      const modal=Object.assign({},confirmationDefinition,{get,setProperties,plan:f.service.pendingPlan,commands:f.service,intl:{t:key=>key},stale:false,isCatalogLaunch:true,alreadyApproved:false,
        set(key,value){if(key==='modalService.modalOpts.plan'){this.plan=value;}else this[key]=value;}});
      await modal.loadHumanInputs();assert.equal(modal.plan.inputsReady,ready);assert.equal(modal.plan.planStatus,ready?'needs_user':'failed');
      assert.deepEqual(modal.humanQuestions,[]);assert.equal(confirmationDefinition.submitDisabled.call(modal),!ready);assert.equal(f.requests.length,1);
    }
    const f=fixture('off'),dto=catalogPlan(),entered=deferred(),barrier=deferred();f.service.reviewInboxPlan(dto);
    f.service.userStore.rawRequest=async()=>{entered.resolve();await barrier.promise;return {body:dto};};
    const pending=f.service.catalogHumanForm(f.service.pendingPlan);await entered.promise;f.service.reviewInboxPlan(plan());const newer=f.service.pendingPlan;
    barrier.resolve();await assert.rejects(pending,{code:'STALE_REFERENCE'});assert.equal(f.service.pendingPlan,newer);
  });

  await test('Catalog review separates accepted work from verified completion and does not claim it is unapplied',async()=>{
    for(const [status,key] of Object.entries({needs_user:'NOT_EXECUTED',accepted:'ACCEPTED',running:'PENDING',failed:'FAILED',unknown:'unknown',cancelled:'NOT_EXECUTED',succeeded:'unknown'})){
      const modal={get,isCatalogLaunch:true,plan:{planStatus:status,verifiedResult:false}};
      assert.equal(confirmationDefinition.catalogStatusKey.call(modal),'apiKeyAudit.outcomes.'+key);
      assert.equal(confirmationDefinition.catalogAfterPreview.call(modal),status!=='needs_user');
    }
    assert.equal(confirmationDefinition.catalogStatusKey.call({get,plan:{planStatus:'succeeded',verifiedResult:true}}),'apiKeyAudit.outcomes.SUCCEEDED');
    const template=fs.readFileSync(path.join(app,'components/modal-confirm-ai-upgrade/template.hbs'),'utf8');assert.ok(template.includes('unless (or this.catalogAfterPreview this.alreadyApproved this.isBrowserEnvironment)'));
  });

  await test('human inbox cancellation works while tools are off and only clears the verified own plan', async () => {
    const f=fixture('off'),plan=resourcePlan();
    f.service.reviewInboxPlan(plan);
    f.service.userStore.rawRequest=async options=>{f.requests.push(options);return {body:{...plan,status:'cancelled',confirmationState:'cancelled'}};};
    const result=await f.service.cancelInboxPlan(plan,f.service.captureReviewContext());
    assert.equal(result.status,'succeeded');assert.equal(result.confirmationState,'cancelled');assert.equal(f.service.pendingPlan,null);
    assert.deepEqual(f.requests,[{url:`projects/project/aiResourceChangePlans/${plan.id}?action=cancel`,method:'POST',data:{}}]);
    const g=fixture('off'),row={...plan,canCancel:true,displayPath:plan.targetPath};
    g.service.userStore.rawRequest=async()=>({body:{...plan,status:'cancelled',confirmationState:'cancelled'}});
    const modal=Object.assign({},modalDefinition,{get,set,setProperties,commands:g.service,intl:{t:key=>key},plans:[row],_loadGeneration:1,_loadedContext:g.service.captureReviewContext()});
    modal.actions.requestCancel.call(modal,row);assert.equal(modal.cancelCandidate,row);
    await modal.actions.cancelPlan.call(modal);assert.deepEqual(modal.plans,[]);assert.equal(modal.cancelCandidate,null);assert.equal(modal.cancelNotice,'webmcp.planCancelled');
    const template=fs.readFileSync(path.join(app,'components/modal-ai-collaboration/template.hbs'),'utf8');
    assert.ok(template.includes('if plan.canCancel'));assert.ok(template.includes('ai-collaboration-confirm-cancel'));assert.ok(template.includes('{{top-errors errors=this.errors}}'));
  });

  await test('late human cancellation preserves a newer preview and never rebuilds a dismissed plan', async () => {
    for(const replacement of ['newer','dismiss']){
      const f=fixture('off'),plan=resourcePlan(),entered=deferred(),barrier=deferred();
      f.service.reviewInboxPlan(plan);
      f.service.userStore.rawRequest=async()=>{entered.resolve();await barrier.promise;return {body:{...plan,status:'cancelled',confirmationState:'cancelled'}};};
      const pending=f.service.cancelInboxPlan(plan,f.service.captureReviewContext());await entered.promise;
      if(replacement==='newer')f.service.reviewInboxPlan(resourcePlan('2'));else f.service.dismissPendingPlan();
      const current=f.service.pendingPlan;barrier.resolve();assert.equal((await pending).status,'succeeded');assert.equal(f.service.pendingPlan,current);
    }
  });

  await test('human cancel refuses submitted plans and guards actor changes before and after submission', async () => {
    const f=fixture('off');
    for(const status of ['accepted','dispatching','running','unknown','succeeded','failed'])assert.equal((await f.service.cancelInboxPlan({...resourcePlan(),status})).reason,'CANNOT_CANCEL');
    assert.equal((await f.service.cancelInboxPlan({...resourcePlan(),operationId:'existing'})).reason,'CANNOT_CANCEL');assert.equal(f.requests.length,0);
    const entered=deferred(),barrier=deferred();f.service.access.ensureSession=async()=>{entered.resolve();await barrier.promise;};
    const before=f.service.cancelInboxPlan(resourcePlan(),f.service.captureReviewContext());await entered.promise;f.snapshot.accountId='other';barrier.resolve();
    assert.equal((await before).code,'CONTEXT_CHANGED');assert.equal(f.requests.length,0);
    const g=fixture('off'),sent=deferred(),reply=deferred(),plan=resourcePlan();g.service.reviewInboxPlan(plan);
    g.service.userStore.rawRequest=async()=>{sent.resolve();await reply.promise;return {body:{...plan,status:'cancelled',confirmationState:'cancelled'}};};
    const after=g.service.cancelInboxPlan(plan,g.service.captureReviewContext());await sent.promise;g.snapshot.accountId='another';g.service.reviewInboxPlan(resourcePlan('2'));const newer=g.service.pendingPlan;
    reply.resolve();const unknown=await after;assert.equal(unknown.status,'unknown');assert.equal(unknown.code,'UNKNOWN_RESULT');assert.equal(g.service.pendingPlan,newer);
  });

  await test('inbox actor changes stop the pending read before it reaches the API', async () => {
    const f = fixture(), barrier = deferred(); let requests = 0;
    f.service.access.ensureSession = () => barrier.promise;
    const modal = Object.assign({}, modalDefinition, {get, set, setProperties, _loadGeneration: 0, commands: f.service, access: f.service.access,
      userStore: {rawRequest: async () => { requests++; return {body: {data: []}}; }}});
    const pending = modal.loadPlans(); f.snapshot.generation = 'replacement'; barrier.resolve(); await pending;
    assert.equal(requests, 0); assert.equal(modal.plans.length, 0);
  });

  await test('initialization starts every build ceiling off until an explicit panel choice', async () => {
    const initializer = fs.readFileSync(path.join(app, 'instance-initializers/webmcp.js'), 'utf8');
    for (const mode of ['off', 'enabled', 'read-only']) {
      const source = initializer.replace("import config from 'ui/config/environment';", `const config = {APP:{webmcpMode:${JSON.stringify(mode)}}};`);
      const {initialize} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
      const calls = [], modes = [], appState = {};
      const registry = {setMode(value) { modes.push(value); }};
      initialize({lookup(name) { calls.push(name); return name === 'application:main' ? {set(key, value) { appState[key] = value; }} : registry; }});
      assert.deepEqual(calls, mode === 'off' ? [] : ['application:main', 'service:webmcp-registry']);
      assert.deepEqual(modes, mode === 'off' ? [] : ['off'], 'initialization must not opt in');
      assert.equal(appState.webmcpAvailable, mode === 'off' ? undefined : true);
      if (mode !== 'off') {
        const modal = Object.assign({}, modalDefinition, {get, set, buildMode: mode, registry});
        await modal.actions.mode.call(modal, 'enabled');
        assert.deepEqual(modes, ['off', mode], 'only the panel choice enables the bounded mode');
      }
    }
  });
  await test('header and collaboration explanation templates preserve their gates and contrast', async () => {
    const headerTemplate = fs.readFileSync(path.join(app, 'components/page-header/template.hbs'), 'utf8');
    assert.match(headerTemplate, /if this\.app\.webmcpAvailable.*page-header-ai-control/);
    const collaborationTemplate = fs.readFileSync(path.join(app, 'components/modal-ai-collaboration/template.hbs'), 'utf8');
    for (const id of ['ai-collaboration-boundary', 'ai-collaboration-confirmation-source']) {
      const paragraph = collaborationTemplate.match(new RegExp(`<p[^>]*id="${id}"[^>]*>`));
      assert.ok(paragraph, `${id} remains visible as explanatory text`);
      assert.ok(!paragraph[0].includes('text-muted'), `${id} inherits the theme's primary readable text color`);
    }
  });
  assert.ok(count > 0, 'test filter matched no cases');
  process.stdout.write(`PASS ${count} focused collaboration UI cases${filter ? ' (filtered)' : ''}\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
