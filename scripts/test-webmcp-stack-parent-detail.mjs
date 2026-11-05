import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const secret = 'PRIVATE_PARENT_PAYLOAD';
const parentTypes = [['load-balancer', 'loadBalancerService'], ['service', 'service'], ['service', 'dnsService'], ['service', 'externalService']];
function fixture(transportKind = 'stdio') {
  const snapshot = {generation: 'g1', accountId: 'principal', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/service'};
  const context = new CommandContext(() => snapshot, (() => { let n = 0; return () => `opaque-${++n}`; })()); context.setMode('enabled');
  const rows = [0, 1].map(i => ({id: `child-${i}`, accountId: 'p1', name: 'same-name', stackId: `parent-${i}`}));
  const stacks = new Map([['parent-0', 'Stack Blue'], ['parent-1', 'Stack Green'], ['parent-new', 'Stack Moved']]);
  const requests = [], faults = {};
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {},
    audit: async () => ({accepted: true, requestId: 'audit'}), request: async request => {
      requests.push(request);
      if (request.url.startsWith('projects/p1/stacks/')) {
        assert.equal(request.method, 'GET'); const id = request.url.slice('projects/p1/stacks/'.length);
        if (faults.parentHidden) throw {status: 403, body: {code: 'KeyScopeDenied', message: secret}};
        assert.ok(stacks.has(id)); return {body: {id, accountId: 'p1', name: stacks.get(id), data: secret}};
      }
      assert.equal(request.method, 'POST');
      if (request.url === 'projects/p1/aiCatalogStackLaunchOptions') return {body: {
        optionsRef: 'acopts-11111111-1111-1111-1111-111111111111', launchEnabled: false, requiredOperations: ['read', 'create', 'update'], questions: []}};
      if (request.url === 'projects/p1/aiCatalogMetadataViews') {
        const templateId = 'ctm-' + 'a'.repeat(64), versionId = 'cvm-' + 'b'.repeat(64);
        return {body: {resourceType: request.data.versions ? 'catalogTemplateVersion' : 'catalogTemplate', data: request.data.versions ?
          [{id: versionId, type: 'catalogTemplateVersion', templateId, version: '1.0', revision: 1}] :
          [{id: templateId, type: 'catalogTemplate', name: 'Catalog', catalogId: 'library', catalogScope: 'global', templateKey: 'safe', templateBase: 'infra', defaultVersion: '1.0'}]}};
      }
      assert.equal(request.url, 'projects/p1/aiResourceViews');
      const {resourceType, resourceId} = request.data;
      if (faults.credential) throw {status: 403, body: {code: 'ApiKeyPolicyChanged', message: secret}};
      if (resourceType === 'stack') {
        if (faults.parentHidden) throw {status: 403, body: {code: 'KeyScopeDenied', message: secret}};
        assert.ok(stacks.has(resourceId));
        return {body: {resourceType, data: [{id: resourceId, accountId: 'p1', name: stacks.get(resourceId), data: secret}]}};
      }
      if (faults.beforeDetail && resourceId) await faults.beforeDetail();
      const selected = resourceId ? rows.filter(row => row.id === resourceId) : rows;
      return {body: {resourceType, data: selected.map(row => ({...row, type: resourceType,
        ...(faults.parentHidden ? {parentResolution: 'unavailable'} : {parentResolution: 'resolved', stackName: stacks.get(row.stackId)}),
        ...faults.projection, data: secret, lbConfig: secret}))}};
    }});
  return {engine, context, snapshot, rows, stacks, requests, faults};
}

test('Stack parent detail: same-name LB refs lead to fresh authorized Stack names in browser and stdio', async () => {
  for (const transportKind of ['browser', 'stdio']) {
    const f = fixture(transportKind), found = await f.engine.execute('find_resources', {family: 'load-balancer', query: 'same-name'});
    assert.equal(found.items.length, 2); assert.notEqual(found.items[0].parentRef, found.items[1].parentRef);
    f.stacks.set('parent-1', 'Stack Green renamed');
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[1].resourceRef});
    assert.equal(detail.parentResolution, 'resolved'); assert.equal(detail.parentRef, found.items[1].parentRef);
    assert.match(detail.nextStep, /get_resource.*parentRef.*Stack/);
    const parent = await f.engine.execute('get_resource', {resourceRef: detail.parentRef});
    assert.equal(parent.fields.name, 'Stack Green renamed');
    assert.equal(transportKind === 'stdio' ? f.requests.at(-1).data.resourceId : f.requests.at(-1).url, transportKind === 'stdio' ? 'parent-1' : 'projects/p1/stacks/parent-1');
    assert.equal(JSON.stringify([found, detail, parent]).includes(secret), false);
    for (const id of ['child-0', 'child-1', 'parent-0', 'parent-1']) assert.equal(JSON.stringify([found, detail, parent]).includes(id), false);
    assert.ok(f.requests.every(row => row.method === 'POST' && row.url.endsWith('/aiResourceViews') || row.method === 'GET' && row.url.startsWith('projects/p1/stacks/')));
  }
});

test('Stack parent detail: hidden parent and credential revocation never reuse list labels or bypass parent authorization', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
  f.faults.parentHidden = true;
  const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(detail.status, 'succeeded'); assert.equal(detail.parentRef, found.items[0].parentRef); assert.equal(detail.parentResolution, 'unavailable');
  assert.match(detail.nextStep, /unavailable/); assert.equal(JSON.stringify(detail).includes('Stack Blue'), false);
  assert.equal((await f.engine.execute('get_resource', {resourceRef: found.items[0].parentRef})).code, 'FORBIDDEN');
  f.faults.credential = true;
  const rejected = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(rejected.code, 'FORBIDDEN'); assert.equal(Object.hasOwn(rejected, 'fields'), false);
  assert.equal(JSON.stringify([detail, rejected]).includes(secret), false);
});

test('Stack parent detail: moved Stack uses fresh identity and generation changes retain stale and in-flight guards', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
  f.rows[0].stackId = 'parent-new';
  const moved = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.notEqual(moved.parentRef, found.items[0].parentRef);
  assert.equal((await f.engine.execute('get_resource', {resourceRef: moved.parentRef})).fields.name, 'Stack Moved');
  f.faults.beforeDetail = async () => { f.snapshot.generation = 'g2'; };
  const raced = await f.engine.execute('get_resource', {resourceRef: found.items[1].resourceRef});
  assert.equal(raced.code, 'CONTEXT_CHANGED'); assert.equal(Object.hasOwn(raced, 'parentRef'), false);
  const before = f.requests.length;
  assert.equal((await f.engine.execute('get_resource', {resourceRef: moved.parentRef})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, before);
});

test('Stack parent detail: service variants share projection while missing or contradictory parent facts remain unavailable', async () => {
  for (const [family, resourceType] of parentTypes) {
    const f = fixture(), found = await f.engine.execute('find_resources', {family, resourceType});
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
    assert.equal(detail.parentRef, found.items[0].parentRef); assert.equal(detail.parentResolution, 'resolved');
  }
  const compatible = fixture(); compatible.faults.projection = {parentResolution: undefined};
  const visible = await compatible.engine.execute('find_resources', {family: 'load-balancer'});
  const compatibleDetail = await compatible.engine.execute('get_resource', {resourceRef: visible.items[0].resourceRef});
  assert.equal(compatibleDetail.parentResolution, 'resolved'); assert.equal(compatibleDetail.parentRef, visible.items[0].parentRef);
  for (const projection of [{stackId: undefined}, {stackName: undefined},
    {parentResolution: 'unavailable', stackName: secret, displayPath: secret}]) {
    const f = fixture(); f.faults.projection = projection;
    const found = await f.engine.execute('find_resources', {family: 'load-balancer'});
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
    if (Object.hasOwn(projection, 'stackId')) assert.equal(found.items[0].parentRef, null);
    else assert.equal(typeof found.items[0].parentRef, 'string');
    assert.equal(found.items[0].parentResolution, 'unavailable');
    assert.equal(detail.parentRef, found.items[0].parentRef); assert.equal(detail.parentResolution, 'unavailable');
    assert.equal(JSON.stringify([found, detail]).includes(secret), false);
  }
});

test('Stack parent detail: no-parent Container and special Catalog version retain their existing output contracts', async () => {
  const f = fixture(), containers = await f.engine.execute('find_resources', {family: 'container'});
  const container = await f.engine.execute('get_resource', {resourceRef: containers.items[0].resourceRef});
  assert.equal(Object.hasOwn(container, 'parentRef'), false); assert.equal(Object.hasOwn(container, 'parentResolution'), false);
  const templates = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplate'});
  const versions = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef: templates.items[0].resourceRef});
  const version = await f.engine.execute('get_resource', {resourceRef: versions.items[0].resourceRef});
  assert.equal(version.parentRef, templates.items[0].resourceRef); assert.equal(Object.hasOwn(version, 'parentResolution'), false);
  assert.equal(version.launchOptions.launchEnabled, false);
});
