'use strict';

// Focused controller/service tests. No browser, framework install or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(__dirname, '../app');
const filterArg = process.argv.find(arg => arg.startsWith('--filter='));
const filter = filterArg && new RegExp(filterArg.slice('--filter='.length));
const cache = new Map();
function sourceUrl(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) { return cache.get(filename); }
  let source = fs.readFileSync(filename, 'utf8');
  source = source.replace(/import Service, \{ service \} from '@ember\/service';/g, 'const Service = {extend: value => value}; const service = () => null;')
    .replace(/import Component from '@ember\/component';/g, 'const Component = {extend: value => value};')
    .replace(/import \{ service \} from '@ember\/service';/g, 'const service = () => null;')
    .replace(/import \{ computed \} from '@ember\/object';/g, 'const computed = (...args) => args.at(-1);')
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
  const {default: headerDefinition} = await import(sourceUrl(path.join(app, 'components/page-header-ai-control/component.js')));
  const plan = (suffix = '1') => ({id: `aiplan-${suffix.repeat(8)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(4)}-${suffix.repeat(12)}`,
    serviceId: '1s1', serviceName: 'web', displayPath: 'Environment/Stack/web', currentImage: 'docker:app:1', requestedImage: 'docker:app:2',
    expiresAt: '2026-10-29T10:00:00Z', confirmationState: 'pending', status: 'preview'});
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
    if (filter && !filter.test(name)) { return; }
    await body(); count++; process.stdout.write(`PASS ${name}\n`);
  }

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
      userStore: {rawRequest: async options => { requests.push(options); return {body: {type: 'collection', data: [plan()]}}; }},
    });
    modal.init(); assert.equal(requests.length, 0);
    await modal.didInsertElement(); assert.equal(requests.length, 1); assert.equal(modal.plans.length, 1);
    assert.equal(requests[0].url, 'projects/project/aiServiceUpgradePlans?limit=20');
    const entered = deferred(), barrier = deferred();
    modal.userStore.rawRequest = async options => { requests.push(options); entered.resolve(); await barrier.promise; return {body: {data: [plan('2')]}}; };
    const late = modal.actions.refresh.call(modal); await entered.promise;
    modal.isDestroying = true; modal.willDestroy(); barrier.resolve(); await late;
    assert.equal(modal.plans.length, 0); assert.equal(requests.length, 2);
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
