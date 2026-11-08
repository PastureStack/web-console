'use strict';
// Focused source tests, using the real engine/service/prefs/route owners. No SDK or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(option('source-root') || path.join(__dirname, '..'));
const baseRoot = option('base-root'), repository = option('base-repository'), commit = option('base-commit');
const cache = new Map();
for (const name of ['property', 'observes']) { if (!Function.prototype[name]) Object.defineProperty(Function.prototype, name, {value() { return this; }}); }
function sourceUrl(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const local = path.join(root, relative), base = baseRoot && path.join(baseRoot, relative);
  let source = fs.existsSync(local) ? fs.readFileSync(local, 'utf8') : base && fs.existsSync(base) ? fs.readFileSync(base, 'utf8') :
    execFileSync('git', ['show', `${commit}:${relative.replaceAll('\\', '/')}`], {cwd: repository, encoding: 'utf8'});
  source = source.replace(/import Service, \{ service \} from '@ember\/service';/g, 'const Service = {extend: (...values) => values.at(-1)}; const service = () => null;')
    .replace(/import Service from '@ember\/service';/g, 'const Service = {extend: (...values) => values.at(-1)};')
    .replace(/import \{ service \} from '@ember\/service';/g, 'const service = () => null;')
    .replace(/import \{ getOwner \} from '@ember\/application';/g, 'const getOwner = object => object._owner;')
    .replace(/import \{ computed \} from '@ember\/object';/g, 'const computed = (...values) => values.at(-1);')
    .replace(/import \{ alias \} from '@ember\/object\/computed';/g, 'const alias = () => null;')
    .replace(/import \{ observer \} from '@ember\/object';/g, 'const observer = (...values) => values.at(-1);')
    .replace(/import Evented from '@ember\/object\/evented';/g, 'const Evented = {};')
    .replace(/import ModalBase from 'lacsso\/components\/modal-base';/g, 'const ModalBase = {extend: value => value};')
    .replace(/import \{ once \} from '@ember\/runloop';/g, 'const once = () => {};')
    .replace(/import \{ reject, resolve, all \} from 'rsvp';/g, 'const reject = Promise.reject.bind(Promise), resolve = Promise.resolve.bind(Promise), all = Promise.all.bind(Promise);')
    .replace(/import \{ run \} from '@ember\/runloop';/g, 'const run = callback => callback();')
    .replace(/import \$ from 'jquery';/g, 'const $ = () => {};')
    .replace(/import EmberObject from '@ember\/object';/g, 'const EmberObject = {create: value => value};')
    .replace(/import \{ later, scheduleOnce, cancel \} from '@ember\/runloop';/g, 'const later = () => {}; const scheduleOnce = () => {}; const cancel = () => {};')
    .replace(/import \{ reject, Promise, resolve \} from 'rsvp';/g, 'const reject = Promise.reject.bind(Promise), resolve = Promise.resolve.bind(Promise);')
    .replace(/import Route from '@ember\/routing\/route';/g, 'const Route = {extend: (...values) => values.at(-1)};')
    .replace(/import (Subscribe|PromiseToCb) from 'ui\/mixins\/[^']+';/g, 'const $1 = {};')
    .replace(/import \{ xhrConcur \} from 'ui\/utils\/platform';/g, 'const xhrConcur = () => {};')
    .replace(/import Errors from 'ui\/utils\/errors';/g, 'const Errors = {status: error => error.status};')
    .replace(/from '(ui\/[^']+|\.\.?\/[^']+)'/g, (_whole, specifier) => {
      let target = specifier.startsWith('ui/') ? `app/${specifier.slice(3)}` : path.posix.join(path.posix.dirname(relative), specifier);
      if (!target.endsWith('.js')) target += '.js';
      return `from '${sourceUrl(target)}'`;
    });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(relative, url); return url;
}
const get = function(key) { return key.split('.').reduce((value, part) => value && value[part], this); };
const set = function(key, value) { this[key] = value; };
const row = values => ({...values, get, set});
const gate = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return {promise, resolve, reject}; };
const tick = () => new Promise(done => setImmediate(done));
async function main() {
  const {CommandContext} = await import(sourceUrl('app/utils/ai-command-context.js'));
  const {CommandEngine} = await import(sourceUrl('app/utils/ai-command-engine.js'));
  const {COMMANDS} = await import(sourceUrl('app/utils/ai-command-contract.js'));
  const {resourceReviewLabels} = await import(sourceUrl('app/utils/ai-resource-review-labels.js'));
  const {default: commandOwner} = await import(sourceUrl('app/services/ai-command-service.js'));
  const {default: actionsOwner} = await import(sourceUrl('app/services/ai-environment-actions.js'));
  const {default: projectsOwner} = await import(sourceUrl('app/services/projects.js'));
  const {default: prefsOwner} = await import(sourceUrl('app/services/prefs.js'));
  const {default: routeOwner} = await import(sourceUrl('app/authenticated/route.js'));
  const {default: modalOwner} = await import(sourceUrl('app/components/modal-confirm-ai-upgrade/component.js'));
  function fixture(transportKind = 'browser') {
    let sequence = 0;
    const snapshot = {generation: 'g1', accountId: 'actor', projectId: 'p1', projectName: 'same-name', schemaProjectId: 'p1', schemaGeneration: 1, route: '/env/p1'};
    const context = new CommandContext(() => ({...snapshot, schemaProjectId: projects ? projects.schemaProjectId : snapshot.schemaProjectId, schemaGeneration: projects ? projects.schemaLoadGeneration : snapshot.schemaGeneration}), () => `ref${++sequence}`); context.setMode('enabled');
    const state = {rows: [], writes: [], writeOptions: [], requests: [], notifications: 0, changes: 0, cookie: 'cookie-one', disconnect: gate(), refresh: gate(), fault: null};
    const projects = Object.assign({}, projectsOwner, {get, set, schemaLoadGeneration: 1, incrementProperty(key) { return ++this[key]; },
      current: row({id: 'p1', uuid: 'project-one', kind: 'project', description: 'current candidate', name: 'same-name', state: 'active'}),
      schemaProjectId: 'p1', store: {}, access: {admin: false}, 'tab-session': {get: () => state.tabProject, set: (_key, value) => { state.tabProject = value; }}});
    projects.active = {firstObject: projects.current};
    const target = row({id: 'p2', uuid: 'project-two', kind: 'project', description: 'selected candidate', name: 'same-name', state: 'active'});
    projects._activeProjectFromId = async id => { if (state.selectionGate) await state.selectionGate.promise;
      if (state.fault === 'forbidden') throw {status: 403};
      const value = id === 'p2' ? target : id === 'p1' ? projects.current : null;
      if (!value) throw {status: 404}; return value; };
    const auth = {get, accountId: 'actor', tokenSnapshot: 'cookie-one', capture: () => snapshot.generation, readShared: () => ({generation: snapshot.generation, accountId: snapshot.accountId}),
      runPassiveSynchronous: async callback => { if (state.commitGate) await state.commitGate.promise;
        const value = callback(); assert.equal(Boolean(value && value.then), false); return value; }};
    function record(values) {
      const value = row({...values});
      value.save = async options => { state.writes.push({...value}); state.writeOptions.push(options); if (state.saveGate) await state.saveGate.promise;
        if (state.fault === 'save') throw Error('PRIVATE SERVER ERROR');
        const saved = {id: value.id || 'pref-one', name: value.name, accountId: 'actor', value: value.value};
        state.rows = [saved]; return record(saved); };
      return value;
    }
    const prefs = Object.assign({}, prefsOwner, {get, notifyPropertyChange: () => state.notifications++, userStore: {
      find: async (_type, _id, options) => { state.requests.push(options); if (state.readbackGate && state.writes.length) await state.readbackGate.promise;
        return state.rows.map(value => record(state.fault === 'readback' && state.writes.length ? {...value, value: '"p1"'} : value)); },
      createRecord: record,
    }});
    projects.prefs = prefs;
    const route = Object.assign({}, routeOwner, {get, set: (key, value) => { state.tabProject = value; }, projects,
      storeReset: {reset: () => state.changes++}, intermediateTransitionTo: () => {},
      store: {resetType: () => {}, _bulkAdd: () => { state.schemaCommits = (state.schemaCommits || 0) + 1; }, rawRequest: async () => {
        if (state.schemaGate) await state.schemaGate.promise;
        if (state.fault === 'schema') projects.incrementProperty('schemaLoadGeneration');
        return {body: {data: []}};
      }},
      disconnectSubscribe: callback => state.disconnect.promise.then(callback),
      refresh: () => {
        if (state.fault === 'transition') throw Error('Cannot create transition');
        const transition = state.refresh.promise.then(async () => {
          const guard = route.environmentHandoffGuard(transition);
          await route.selectProject(transition, guard);
          await route.loadProjectSchemas(guard);
          Object.assign(snapshot, {projectId: projects.current.id, projectName: projects.current.name, schemaProjectId: projects.schemaProjectId, schemaGeneration: projects.schemaLoadGeneration, route: '/env/p2'});
          if (state.onSwitch) state.onSwitch();
        });
        transition.params = {'authenticated.project': {project_id: state.fault === 'fallback' ? 'p1' : state.tabProject}};
        state.transition = transition; return transition;
      },
    });
    const actions = Object.assign({}, actionsOwner, {get, projects, prefs, authSession: auth, cookies: {get: () => state.cookie}, commandContext: {context},
      intl: {t: key => key}, _owner: {lookup: key => { assert.equal(key, 'route:authenticated'); return route; }}});
    const service = Object.assign({}, commandOwner, {get, set, environmentActions: actions, commandContext: {context}, pendingPlan: null,
      access: {ensureSession: async () => { if (state.sessionGate) await state.sessionGate.promise; }}});
    const engine = new CommandEngine({context, transportKind, browserEnvironment: actions, ensureSession: service.access.ensureSession,
      onPlan: (plan, expected) => service.publishPlan(plan, expected), audit: async () => ({accepted: true, requestId: `audit${++sequence}`}),
      request: async request => { state.requests.push(request);
        if (request.url === 'projects?limit=50') return {body: {data: [projects.current, target].map(value => ({id: value.id, name: value.name, description: value.description, state: 'active'}))}};
        if (request.url.endsWith('/aiResourceViews')) return {body: {resourceType: 'project', data: [projects.current, target].map(value => ({id: value.id, type: 'project', name: value.name, description: value.description, state: 'active'}))}};
        throw Error('Unexpected native process or plan request'); }});
    service.engine = engine;
    const find = () => engine.execute('find_resources', {family: 'environment', resourceType: 'project', query: 'same-name'});
    const preview = async operation => { const found = await find(); assert.ok(found.items, JSON.stringify(found)); assert.equal(found.items.length, 2);
      assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
      assert.notEqual(found.items[0].fields.description, found.items[1].fields.description);
      return engine.execute('preview_resource_change', {resourceType: 'project', operation, targetRef: found.items[1].resourceRef, parameters: {}}); };
    return {snapshot, context, state, projects, target, auth, prefs, route, actions, service, engine, find, preview};
  }
  let count = 0;
  async function test(name, body) { if (option('filter') && !name.includes(option('filter'))) return; await body(); count++; console.log(`PASS ${name}`); }
  await test('twelve tools keep name queries opaque selection and Browser-only preview without model mutation', async () => {
    assert.equal(COMMANDS.length, 12);
    for (const operation of ['switch_context', 'set_default']) {
      const f = fixture(); const preview = await f.preview(operation);
      assert.equal(preview.status, 'needs_user'); assert.equal(preview.verifiedResult, false);
      assert.equal(JSON.stringify(preview).includes('project-two'), false); assert.equal(preview.context, undefined);
      assert.equal(JSON.stringify(preview).includes('"p2"'), false); assert.equal(preview.displayDiff[1].after, 'selected candidate');
      const labels = resourceReviewLabels(preview, key => key);
      assert.equal(labels.operationLabel, operation === 'switch_context' ? 'action.switchEnvironment' : 'action.setDefault');
      assert.equal(labels.displayChanges[0].fieldLabel, operation === 'switch_context' ? 'nav.environment.label' : 'action.setDefault');
      assert.equal(labels.displayChanges[1].informational, true);
      const apply = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
      assert.equal(apply.status, 'needs_user'); assert.equal(f.state.writes.length, 0); assert.equal(f.state.changes, 0);
      const found = await f.find();
      for (const input of [{targetRef: 'p2', parameters: {}}, {targetRef: found.items[1].resourceRef, parameters: {name: 'invalid'}}]) {
        const result = await f.engine.execute('preview_resource_change', {resourceType: 'project', operation, ...input});
        assert.notEqual(result.status, 'needs_user');
      }
      const bridge = fixture('stdio'); assert.equal((await bridge.preview(operation)).status, 'needs_user');
      assert.equal(bridge.service.pendingPlan, null); assert.equal(bridge.state.writes.length, 0); assert.equal(bridge.state.changes, 0);
    }
  });
  await test('default POST and PUT await save and exact own readback with no native proof', async () => {
    for (const existing of [false, true, 'null']) {
      const f = fixture(); if (existing) f.state.rows = [{id: 'pref-one', accountId: 'actor', name: 'defaultProjectId', value: existing === 'null' ? 'null' : '"p1"'}];
      await f.preview('set_default'); f.state.saveGate = gate(); f.state.readbackGate = gate();
      const plan = f.service.pendingPlan, confirming = f.service.confirmPendingPlan(plan); let settled = false; confirming.then(() => { settled = true; });
      await tick(); assert.equal(f.state.writes.length, 1); assert.equal(settled, false);
      assert.equal(Boolean(f.state.writes[0].id), Boolean(existing)); f.state.saveGate.resolve(); await tick(); assert.equal(settled, false);
      f.state.readbackGate.resolve(); const done = await confirming;
      assert.equal(done.status, 'succeeded'); assert.equal(done.effectScope, 'account-preference'); assert.equal(done.verifiedResult, false);
      assert.equal(done.readbackComplete, true); assert.equal(f.state.notifications, 1); assert.equal(f.state.rows[0].value, '"p2"');
      assert.equal(f.state.changes, 0); assert.equal(f.snapshot.projectId, 'p1');
    }
    const same = fixture(); same.state.rows = [{id: 'pref-one', accountId: 'actor', name: 'defaultProjectId', value: '"p2"'}];
    await same.preview('set_default'); const settled = await same.service.confirmPendingPlan(same.service.pendingPlan);
    assert.equal(settled.status, 'succeeded'); assert.equal(settled.readbackComplete, true); assert.equal(same.state.writes.length, 0);
  });
  await test('preference requests bind the original actor without shared cookies or option reuse', async () => {
    for (const existing of [false, true]) {
      const f = fixture();
      if (existing) f.state.rows = [{id: 'pref-one', accountId: 'actor', name: 'defaultProjectId', value: '"p1"'}];
      await f.preview('set_default');
      const result = await f.service.confirmPendingPlan(f.service.pendingPlan);
      assert.equal(result.status, 'succeeded');
      const requests = [...f.state.requests.filter(request => request.url === 'userpreferences'), ...f.state.writeOptions];
      assert.equal(requests.length, 4, 'preview, pre-write read, write and readback retain the same actor');
      for (const request of requests) {
        assert.equal(request.credentials, 'omit');
        assert.equal(request.headers.Authorization, 'Bearer cookie-one');
      }
      assert.equal(new Set(requests.map(request => request.headers)).size, requests.length, 'each request owns its header object');
      assert.equal(JSON.stringify(result).includes('cookie-one'), false);
    }
    const f = fixture(); await f.preview('set_default'); f.state.saveGate = gate();
    const submitted = f.service.confirmPendingPlan(f.service.pendingPlan); await tick();
    assert.equal(f.state.writes.length, 1);
    f.state.cookie = 'cookie-two'; f.auth.tokenSnapshot = 'cookie-two'; f.snapshot.accountId = 'other-actor';
    const newer = {planRef: 'new-actor-review'}; f.service.publishPlan(newer);
    f.state.saveGate.resolve(); const result = await submitted;
    assert.equal(result.status, 'unknown'); assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.writeOptions[0].headers.Authorization, 'Bearer cookie-one');
    assert.equal(f.state.writeOptions[0].credentials, 'omit');
    assert.equal(f.state.requests.filter(request => request.url === 'userpreferences').length, 2, 'no new-actor readback or automatic retry');
    assert.equal(f.service.pendingPlan, newer);
  });
  await test('human review revision generation expiry and repeated confirms cannot submit stale or duplicate writes', async () => {
    for (const change of ['generation', 'account', 'cookie', 'adopt', 'review', 'notice', 'payload', 'expiry']) {
      const f = fixture(); await f.preview('set_default'); f.state.commitGate = gate();
      const old = f.service.pendingPlan, confirming = f.service.confirmPendingPlan(old); await tick();
      if (change === 'generation') { f.snapshot.generation = 'g2'; }
      if (change === 'account') { f.snapshot.accountId = 'other-actor'; }
      if (change === 'cookie') { f.state.cookie = 'cookie-two'; }
      if (change === 'adopt') { f.state.cookie = 'cookie-two'; f.auth.tokenSnapshot = 'cookie-two'; }
      if (change === 'payload') { old.displayDiff[0].after = 'different reviewed target'; }
      if (change === 'notice') f.service.operationNotice = {unknown: true};
      if (change === 'review') f.service.publishPlan({...old});
      if (change === 'expiry') f.context.resolve(old.planRef, 'plan', f.context.capture()).expiresAt = 0;
      const replacement = f.service.pendingPlan; f.state.commitGate.resolve();
      assert.notEqual((await confirming).status, 'succeeded'); assert.equal(f.state.writes.length, 0);
      assert.equal(f.service.pendingPlan, replacement);
    }
    const after = fixture(); await after.preview('set_default'); after.state.saveGate = gate();
    const submitted = after.service.confirmPendingPlan(after.service.pendingPlan); await tick();
    const newer = {...after.service.pendingPlan, planRef: 'new-review'}; after.service.publishPlan(newer); after.snapshot.generation = 'g2';
    after.state.saveGate.resolve(); const unknown = await submitted;
    assert.equal(unknown.status, 'unknown'); assert.equal(after.state.writes.length, 1); assert.equal(after.service.pendingPlan, newer);
    const f = fixture(); await f.preview('set_default'); f.state.saveGate = gate(); const plan = f.service.pendingPlan;
    const first = f.service.confirmPendingPlan(plan); await tick(); const second = await f.service.confirmPendingPlan(plan);
    assert.notEqual(second.status, 'succeeded'); assert.equal(f.state.writes.length, 1); f.state.saveGate.resolve(); await first;
  });
  await test('failed forbidden changed default wrong owner and readback mismatch never report completion', async () => {
    for (const fault of ['save', 'readback', 'preference', 'owner', 'forbidden']) {
      const f = fixture(); await f.preview('set_default');
      if (fault === 'preference' || fault === 'owner') f.state.rows = [{id: 'other', name: 'defaultProjectId', accountId: fault === 'owner' ? 'other' : 'actor', value: '"p1"'}];
      else f.state.fault = fault;
      const result = await f.service.confirmPendingPlan(f.service.pendingPlan);
      assert.notEqual(result.status, 'succeeded'); assert.equal(result.readbackComplete, undefined);
      if (['preference', 'owner', 'forbidden'].includes(fault)) assert.equal(f.state.writes.length, 0);
      assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
    }
  });
  await test('route waits disconnect and exact schema settlement invalidates refs without clearing replacement review', async () => {
    const f = fixture(); await f.preview('switch_context'); const old = f.service.pendingPlan;
    const confirming = f.service.confirmPendingPlan(old); await tick(); assert.equal(f.state.changes, 0);
    f.state.disconnect.resolve(); await tick(); assert.equal(f.state.changes, 1); assert.throws(() => f.context.capture());
    let settled = false; confirming.then(() => { settled = true; }); await tick(); assert.equal(settled, false);
    const replacement = {...old, planRef: 'replacement'};
    f.state.onSwitch = () => { f.service.dismissPendingPlan(); f.service.publishPlan(replacement); };
    f.state.refresh.resolve(); const result = await confirming;
    assert.equal(result.status, 'succeeded'); assert.equal(result.effectScope, 'browser-context'); assert.equal(result.verifiedResult, false);
    assert.equal(result.referencesInvalidated, true); assert.equal(f.service.pendingPlan, replacement);
    assert.throws(() => f.context.resolve(old.planRef, 'plan', f.context.capture()));
    for (const fault of ['fallback', 'schema']) {
      const f = fixture(); await f.preview('switch_context'); f.state.fault = fault;
      const work = f.service.confirmPendingPlan(f.service.pendingPlan); f.state.disconnect.resolve(); f.state.refresh.resolve();
      assert.notEqual((await work).status, 'succeeded');
    }
  });
  await test('actual selection and schema commits reject an old handoff while ordinary callers retain their behavior', async () => {
    for (const replacement of ['generation', 'adopt', 'aborted', 'handoff']) {
      const f = fixture(); await f.preview('switch_context'); const work = f.service.confirmPendingPlan(f.service.pendingPlan);
      await tick(); f.state.selectionGate = gate(); f.state.disconnect.resolve(); f.state.refresh.resolve(); await tick();
      const next = row({id: 'p3', uuid: 'third-project', kind: 'project', name: 'new context', state: 'active'});
      f.projects.current = next; f.projects.schemaProjectId = 'p3'; f.state.tabProject = 'p3';
      const newer = {planRef: 'new-context-review'}; f.service.publishPlan(newer);
      let marker;
      if (replacement === 'generation') f.snapshot.generation = 'g2';
      if (replacement === 'adopt') { f.state.cookie = 'cookie-two'; f.auth.tokenSnapshot = 'cookie-two'; }
      if (replacement === 'aborted') f.state.transition.isAborted = true;
      if (replacement === 'handoff') f.route._browserEnvironmentHandoff = marker = {target: next};
      f.state.selectionGate.resolve(); const result = await work;
      assert.notEqual(result.status, 'succeeded'); assert.equal(f.projects.current, next); assert.equal(f.state.tabProject, 'p3');
      assert.equal(f.service.pendingPlan, newer); assert.equal(f.state.writes.length, 0);
      if (marker) assert.equal(f.route._browserEnvironmentHandoff, marker);
    }
    for (const change of ['generation', 'adopt']) {
      const f = fixture(); await f.preview('switch_context'); f.state.schemaGate = gate();
      const work = f.service.confirmPendingPlan(f.service.pendingPlan); f.state.disconnect.resolve(); f.state.refresh.resolve(); await tick();
      assert.equal(f.projects.current.id, 'p2');
      if (change === 'generation') f.snapshot.generation = 'g2';
      else { f.state.cookie = 'cookie-two'; f.auth.tokenSnapshot = 'cookie-two'; }
      f.projects.schemaProjectId = 'p2';
      const newer = {planRef: 'new-actor-review'}; f.service.publishPlan(newer);
      f.state.schemaGate.resolve(); assert.notEqual((await work).status, 'succeeded');
      assert.equal(f.state.schemaCommits || 0, 0); assert.equal(f.service.pendingPlan, newer);
    }
    const previewing = fixture(); previewing.state.selectionGate = gate(); const previewWork = previewing.preview('set_default'); await tick();
    previewing.state.cookie = 'cookie-two'; previewing.auth.tokenSnapshot = 'cookie-two'; previewing.state.selectionGate.resolve();
    assert.notEqual((await previewWork).status, 'needs_user'); assert.equal(previewing.service.pendingPlan, null);
    const ordinary = fixture(); ordinary.projects.prefs = {get: () => null, set: (_key, value) => { ordinary.state.legacyDefault = value; }};
    await ordinary.projects.selectDefault('p1', null);
    assert.equal(ordinary.projects.current.id, 'p1'); assert.equal(ordinary.state.legacyDefault, 'p1');
  });
  await test('old modal completion cannot approve a replacement review', async () => {
    const ordinary = Object.assign({}, modalOwner, {get, set, setProperties: values => Object.assign(ordinary, values), plan: {planRef: 'ordinary'},
      intl: {t: key => key}, submitDisabled: false, stale: false, approved: false,
      commands: {confirmPendingPlan: async () => ({status: 'succeeded', confirmationState: 'approved'})}});
    await ordinary.actions.confirm.call(ordinary); assert.equal(ordinary.approved, true); assert.equal(ordinary.saving, false);
    for (const failure of [false, true]) {
      const barrier = gate(), old = {planRef: 'one'}, replacement = {planRef: 'two'};
      const modal = Object.assign({}, modalOwner, {get, set, setProperties: values => Object.assign(modal, values), plan: old,
        intl: {t: key => key}, submitDisabled: false, stale: false, approved: false, commands: {confirmPendingPlan: () => barrier.promise}});
      const result = modal.actions.confirm.call(modal); modal.plan = replacement; modal.saving = 'new-review-saving'; modal.errors = ['new-review-error'];
      if (failure) barrier.reject(Error('PRIVATE OLD ERROR')); else barrier.resolve({status: 'succeeded', confirmationState: 'approved'});
      await result; assert.notEqual(modal.approved, true); assert.equal(modal.plan, replacement);
      assert.equal(modal.saving, 'new-review-saving'); assert.deepEqual(modal.errors, ['new-review-error']);
    }
  });
  console.log(`BROWSER_ENVIRONMENT_METHODS_PASS=${count}`);
}
main().catch(error => { console.error(String(error.stack || error).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '[loaded source]')); process.exitCode = 1; });
