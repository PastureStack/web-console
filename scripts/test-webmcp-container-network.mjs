import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {CommandContext, CommandEngine, CommandError, containerNetworkReview, publicError} from '../bridge/shared-modules.mjs';

const id = 'aichange-11111111-1111-1111-1111-111111111111';
const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));

function fixture() {
  let sequence = 0, plan, dispatches = 0;
  const snapshot = {generation: 'g1', accountId: '1a1', projectId: '1a5', projectName: 'Default', schemaProjectId: '1a5', schemaGeneration: 1, route: '/containers'};
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], containers = ['source', 'selected', 'destination'].map(suffix => ({id: `container-${suffix}`, uuid: `container-uuid-${suffix}`, accountId: '1a5', name: 'same-name', state: 'running'}));
  const ports = ['source', 'selected'].map(suffix => ({id: `port-${suffix}`, uuid: `port-uuid-${suffix}`, instanceId: `container-${suffix}`, accountId: '1a5', name: 'same-port',
    state: 'active', publicPort: 8000, privatePort: 80, protocol: 'tcp', bindAddress: '127.0.0.1', data: {secret: 'PRIVATE-CANARY'}}));
  const links = [{id: 'link-selected', uuid: 'link-uuid', instanceId: 'container-selected', accountId: '1a5', name: 'same-link', linkName: 'db', state: 'active'}];
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {}, wait: async () => {},
    audit: async () => ({accepted: true, requestId: `audit-${++sequence}`}), request: async request => {
      requests.push(request);
      if ( request.url === 'projects/1a5/aiResourceViews' ) {
        const {resourceType, parentId, resourceId} = request.data;
        let rows = resourceType === 'container' ? containers : resourceType === 'port' ? ports : links;
        if ( parentId ) rows = rows.filter(row => row.instanceId === parentId);
        if ( resourceId ) rows = rows.filter(row => row.id === resourceId);
        return {body: {resourceType, data: rows}};
      }
      if ( request.url === 'projects/1a5/aiResourceChangePlans' ) {
        const {resourceType, operation, resourceId, parameters} = request.data;
        plan = {id, resourceType, operation, resourceId, targetPath: 'same-name [source-uuid] / 80/tcp',
          changes: resourceType === 'port' ? [
            {field: 'sourceContainer', before: 'same-name [source-uuid]', after: 'same-name [source-uuid]'},
            {field: 'publicPort', before: 8000, after: parameters.publicPort}, {field: 'privatePort', before: 80, after: 80},
            {field: 'protocol', before: 'tcp', after: 'tcp'}, {field: 'bindAddress', before: '127.0.0.1', after: '127.0.0.1'},
          ] : [{field: 'sourceContainer', before: 'same-name [source-uuid]', after: 'same-name [source-uuid]'},
            {field: 'linkName', before: 'db', after: 'db'}, {field: 'targetContainer', before: 'same-name [old-uuid]', after: 'same-name [destination-uuid]'}],
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-08T23:00:00Z'};
        return {body: structuredClone(plan)};
      }
      if ( request.url.endsWith('?action=confirm') ) { plan.confirmationState = 'approved'; return {body: structuredClone(plan)}; }
      if ( request.url.endsWith('?action=apply') ) {
        if ( plan.confirmationState !== 'approved' ) throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: structuredClone(plan)};
      }
      if ( request.url.endsWith(id) ) return {body: structuredClone(plan)};
      throw new Error('Unexpected route');
    }});
  return {engine, context, snapshot, requests, plan: () => plan, dispatches: () => dispatches,
    mutations: action => requests.filter(row => row.method === 'POST' && row.url.endsWith(`?action=${action}`)).length};
}

async function references(f, type = 'port') {
  const found = await f.engine.execute('find_resources', {family: 'container', resourceType: 'container'});
  assert.equal(found.items.length, 3);
  const source = found.items[1].resourceRef;
  const children = await f.engine.execute('find_resources', {family: 'container', resourceType: type, parentRef: source});
  assert.equal(children.items.length, 1); assert.equal(children.items[0].parentRef, source);
  assert.equal(JSON.stringify(children).includes('PRIVATE-CANARY'), false);
  return {targetRef: children.items[0].resourceRef, destination: found.items[2].resourceRef};
}

test('container network: exact same-name child selection, one native body and human approval', async () => {
  const f = fixture(), refs = await references(f);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'port', operation: 'update_public_port', targetRef: refs.targetRef, parameters: {publicPort: null}});
  assert.equal(preview.status, 'needs_user'); assert.deepEqual(f.requests.at(-1).data.parameters,
    {publicPort: null, resourceUuid: 'port-uuid-selected', sourceId: 'container-selected', sourceUuid: 'container-uuid-selected'});
  assert.equal(f.requests.at(-1).data.resourceId, 'port-selected'); assert.equal(JSON.stringify(preview).includes('port-selected'), false);
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.dispatches(), 0); assert.equal((await f.engine.confirmPlan(preview.planRef)).status, 'succeeded');
  const result = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(result.status, 'accepted'); assert.equal(result.completionScope, 'native-container-network-configuration');
  assert.equal(result.applicationConnectivityVerified, false); assert.equal(result.linkEnvironmentRebuilt, false); assert.equal(f.dispatches(), 1);
});

test('container network: link target is a second opaque Container reference, never a raw id or batch', async () => {
  const f = fixture(), refs = await references(f, 'instanceLink');
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'instanceLink', operation: 'update_target', targetRef: refs.targetRef,
    parameters: {targetInstanceRef: refs.destination}});
  assert.equal(preview.status, 'needs_user'); assert.deepEqual(f.requests.at(-1).data.parameters,
    {targetInstanceId: 'container-destination', targetInstanceUuid: 'container-uuid-destination', resourceUuid: 'link-uuid', sourceId: 'container-selected', sourceUuid: 'container-uuid-selected'});
  assert.equal(f.requests.at(-1).data.resourceId, 'link-selected');
  for (const parameters of [{targetInstanceId: 'container-destination'}, {targetInstanceRef: 'container-destination'},
    {targetInstanceRef: refs.destination, linkName: 'other'}, {targetInstanceRef: null}]) {
    const count = f.requests.length;
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'instanceLink', operation: 'update_target', targetRef: refs.targetRef, parameters});
    assert.notEqual(result.status, 'needs_user'); assert.equal(f.requests.length, count);
  }
});

test('container network: omitted parent, bad ports and unrelated fields stop before transport', async () => {
  const f = fixture(); let count = f.requests.length;
  assert.equal((await f.engine.execute('find_resources', {family: 'container', resourceType: 'port'})).code, 'INVALID_INPUT'); assert.equal(f.requests.length, count);
  const refs = await references(f);
  for (const parameters of [{publicPort: 0}, {publicPort: 65536}, {publicPort: 1.1}, {publicPort: '8080'}, {publicPort: 8080, privatePort: 90}, {ports: [80]}]) {
    count = f.requests.length;
    assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'port', operation: 'update_public_port', targetRef: refs.targetRef, parameters})).code, 'INVALID_INPUT');
    assert.equal(f.requests.length, count);
  }
});

test('container network: changed or omitted literal review blocks both confirm and apply with zero mutation POST', async () => {
  for (const [action, mutation] of [['confirm', 'changed'], ['apply', 'changed'], ['confirm', 'omitted'], ['apply', 'omitted']]) {
    const f = fixture(), refs = await references(f);
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'port', operation: 'update_public_port', targetRef: refs.targetRef, parameters: {publicPort: 8080}});
    if (mutation === 'changed') {
      const row = f.plan().changes.find(row => row.field === 'bindAddress'); row.before = row.after = '0.0.0.0';
    } else f.plan().changes = f.plan().changes.filter(row => row.field !== 'sourceContainer');
    const result = action === 'confirm' ? await f.engine.confirmPlan(preview.planRef) : await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    assert.equal(result.code, mutation === 'changed' ? 'CONFLICT' : action === 'apply' ? 'UNKNOWN_RESULT' : 'INVALID_RESPONSE', JSON.stringify({action, mutation, result}));
    assert.equal(f.mutations(action), 0); assert.equal(f.dispatches(), 0);
  }
});

test('container network: actual human inbox owner re-reads exact review before its confirm POST', async () => {
  const source = readFileSync(new URL('../app/services/ai-command-service.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default Service.extend(', 'return Service.extend(');
  const owner = new Function('Service', 'service', 'CommandEngine', 'serviceCreateReview', 'serviceUpgradeReview', 'containerNetworkReview', 'publicError', 'CommandError', 'safeCatalogQuestions', 'CATALOG_LAUNCH_COLLECTION', source)(
    {extend: value => value}, () => ({}), CommandEngine, () => null, () => null, containerNetworkReview, publicError, CommandError, () => ({}), 'aiCatalogStackLaunchPlans');
  const f = fixture(), refs = await references(f);
  const summary = await f.engine.execute('preview_resource_change', {resourceType: 'port', operation: 'update_public_port', targetRef: refs.targetRef, parameters: {publicPort: 8080}});
  const plan = {...summary, humanOnly: true, serverPlanId: id, serverResourceId: 'port-selected', context: f.snapshot};
  plan.reviewSignature = containerNetworkReview(plan);
  let posts = 0;
  const receiver = {...owner, engine: f.engine, assertReviewContext() {}, publishPlan() {}, get(name) {
    if (name === 'access') return {ensureSession: async () => {}};
    if (name === 'userStore') return {rawRequest: async request => {if (request.method === 'POST') posts++; return {body: structuredClone(f.plan())};}};
  }};
  f.plan().changes = f.plan().changes.filter(row => row.field !== 'sourceContainer');
  const result = await receiver.confirmHumanPlan(plan); assert.ok(['CONFLICT', 'INVALID_RESPONSE'].includes(result.code)); assert.equal(posts, 0);
});

test('container network: all thirteen locales have native review labels and preserve literal endpoints', () => {
  const yaml = createRequire(new URL('../package.json', import.meta.url))('js-yaml');
  const directory = new URL('../translations/', import.meta.url);
  const locales = readdirSync(directory).filter(name => name.endsWith('.yaml') && name !== 'none.yaml');
  assert.equal(locales.length, 13);
  const summary = {resourceType: 'port', operation: 'update_public_port', displayDiff: [{field: 'publicPort', before: 8000, after: 8080},
    {field: 'privatePort', before: 80, after: 80}, {field: 'protocol', before: 'tcp', after: 'tcp'}, {field: 'bindAddress', before: '127.0.0.1', after: '127.0.0.1'}]};
  for (const locale of locales) {
    const lines = readFileSync(new URL(locale, directory), 'utf8').split(/\r?\n/);
    const translate = key => {
      const parents = [];
      for (const line of lines) {
        const match = line.match(/^( *)([A-Za-z][A-Za-z0-9_-]*):(?:\s+(.*))?$/);
        if (!match) continue;
        const depth = match[1].length / 2; parents.length = depth; parents[depth] = match[2];
        if (parents.join('.') !== key) continue;
        const value = yaml.load(match[3]); assert.equal(typeof value, 'string', `${locale}: ${key}`); assert.ok(value.trim()); return value;
      }
      assert.fail(`${locale}: missing ${key}`);
    };
    const result = resourceReviewLabels(summary, translate);
    assert.equal(result.displayChanges[0].after, '8080'); assert.equal(result.displayChanges[3].after, '127.0.0.1');
    resourceReviewLabels({resourceType: 'instanceLink', operation: 'update_target', displayDiff: [
      {field: 'sourceContainer', before: 'source [uuid1]', after: 'source [uuid1]'}, {field: 'linkName', before: 'db', after: 'db'},
      {field: 'targetContainer', before: 'old [uuid2]', after: 'new [uuid3]'}]}, translate);
  }
  const labels = resourceReviewLabels(summary, key => key);
  assert.equal(labels.resourceTypeLabel, 'generic.ports'); assert.equal(labels.displayChanges[0].fieldLabel, 'formPorts.public.label');
  assert.equal(labels.displayChanges[0].after, '8080'); assert.equal(labels.displayChanges[3].after, '127.0.0.1');
});

test('container network: actual native UI saves the exact before tuple and restores a rejected value', async () => {
  const source = readFileSync(new URL('../app/components/edit-container/component.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export default ModalBase.extend(', 'return ModalBase.extend(');
  const get = (object, key) => key.split('.').reduce((value, part) => value && value[part], object);
  const owner = new Function('EmberObject', 'get', 'all', 'allSettled', 'resolve', 'next', 'alias', 'NewOrEdit', 'ModalBase', source)(
    {}, get, Promise.all.bind(Promise), values => Promise.allSettled(values).then(results => results.map(result => ({...result, state: result.status === 'fulfilled' ? 'fulfilled' : 'rejected'}))),
    Promise.resolve.bind(Promise), () => {}, () => null, {}, {extend: (mixin, value) => value});
  const before = {uuid: 'port-uuid', sourceUuid: 'source-uuid', accountId: '1a5', instanceId: '1i3', publicPort: 8000,
    privatePort: 80, protocol: 'tcp', bindAddress: ''};
  const saved = [], obj = {...before, set(key, value) {this[key] = value;}, save(options) {saved.push(options); return Promise.resolve(this);}};
  const receiver = {...owner, model: {instance: {uuid: before.sourceUuid}}, portsArray: [{public: '8080', obj}], get(key) {return get(this, key);}};
  await receiver.savePorts(); assert.equal(obj.publicPort, 8080); assert.equal(saved.length, 1);
  assert.deepEqual(JSON.parse(saved[0].headers['X-PastureStack-Port-Before']), before);
  obj.save = () => Promise.reject(new Error('PortUpdateConflict')); receiver.portsArray[0].public = '9090';
  await assert.rejects(receiver.savePorts(), /PortUpdateConflict/); assert.equal(obj.publicPort, 8080);
  receiver.portsArray[0].public = '8080'; await receiver.savePorts(); assert.equal(saved.length, 1);
  receiver.portsArray[0].public = '9090'; obj.uuid = undefined;
  obj.save = () => {saved.push('unexpected'); return Promise.resolve(obj);};
  await assert.rejects(receiver.savePorts(), /PortUpdatePreconditionRequired/);
  assert.equal(obj.publicPort, 8080); assert.equal(saved.length, 1);
});

test('container network: native denial errors have fixed guidance without inventory details or permission changes', () => {
  const unavailable = publicError({status: 422, body: {code: 'PortUnavailable', detail: 'HIDDEN-PROJECT-CANARY'}});
  assert.equal(unavailable.reason, 'PORT_CONFLICT'); assert.match(unavailable.nextStep, /human approval/);
  assert.ok(!JSON.stringify(unavailable).includes('HIDDEN-PROJECT-CANARY'));
  for (const [status, code] of [[409, 'PortUpdateConflict'], [409, 'PortUpdateBusy'], [428, 'PortUpdatePreconditionRequired']])
    assert.equal(publicError({status, body: {code}}).code, 'CONFLICT');
  assert.equal(publicError({status: 403, body: {code: 'PortUnavailable'}}).code, 'FORBIDDEN');
  assert.equal(publicError({status: 401, body: {code: 'PortUnavailable'}}).code, 'SESSION_REQUIRED');
});
