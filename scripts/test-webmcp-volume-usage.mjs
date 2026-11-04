import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

function fixture(transportKind = 'browser') {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/volumes'};
  let next = 0;
  const context = new CommandContext(() => snapshot, () => `opaque${++next}`); context.setMode('read-only');
  const requests = [], body = {id: 'v1', type: 'volume', name: 'data', usageReferencesStatus: 'unknown', usageReferences: [
    {containerId: 'INTERNAL_CONTAINER_11', name: 'same', state: 'running', mountPath: '/data', readOnly: true, stackResolution: 'resolved', stackName: 'Blue'},
    {containerId: 'INTERNAL_CONTAINER_12', name: 'same', state: 'stopped', mountPath: '/data', readOnly: false, stackResolution: 'resolved', stackName: 'Green'},
  ]};
  let mutate;
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, audit: async () => ({accepted: true, requestId: `audit${++next}`}), request: async request => {
    requests.push(request); if (mutate) mutate();
    if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: request.data.resourceType, data: [request.data.resourceType === 'volume' ? body : {id: request.data.resourceId, name: 'same', state: 'stopped'}]}};
    if (request.url.startsWith('projects/p1/containers/')) return {body: {id: request.url.split('/').at(-1), name: 'same', state: 'stopped'}};
    throw Error('Unexpected transport');
  }});
  const ref = context.reference('resource', {id: 'v1', family: 'storage', resourceType: 'volume', scope: 'project'}, context.capture());
  return {snapshot, context, engine, requests, body, ref, mutate: fn => {mutate = fn;}};
}

test('volume detail shares browser and Bridge core: safe stopped/active same-name targets become context-bound refs with Stack identity', async () => {
  for (const transport of ['browser', 'stdio']) {
    const f = fixture(transport), result = await f.engine.execute('get_resource', {resourceRef: f.ref});
    assert.equal(result.status, 'succeeded'); assert.equal(result.usageReferences.availability, 'unknown');
    const [a,b] = result.usageReferences.items; assert.notEqual(a.containerRef, b.containerRef);
    assert.equal(a.stackName, 'Blue'); assert.equal(b.stackName, 'Green'); assert.equal(a.readOnly, true); assert.equal(b.state, 'stopped');
    assert.doesNotMatch(JSON.stringify(result), /INTERNAL_CONTAINER|containerId|hostPath|launchConfig|environment/);
    assert.match(result.nextStep, /Empty results do not mean unused or safe to delete/);
    assert.match(result.nextStep, /container destinations, not host filesystem paths/);
    assert.equal(f.requests[0].url, 'projects/p1/aiResourceViews'); assert.equal(f.requests[0].data.resourceType, 'volume');
    const fresh = await f.engine.execute('get_resource', {resourceRef: b.containerRef}); assert.equal(fresh.status, 'succeeded');
    assert.ok(f.requests.every(r => r.method === 'GET' || r.url === 'projects/p1/aiResourceViews'));
    f.snapshot.generation = 'g2'; assert.equal((await f.engine.execute('get_resource', {resourceRef: a.containerRef})).code, 'STALE_REFERENCE');
  }
});

test('volume empty, partial, old-server or fifty-row snapshots stay unknown and cannot create a deletion grant', async () => {
  for (const shape of [[], undefined, Array.from({length:50}, (_,i) => ({containerId:`private${i}`,name:'same',state:'stopped',mountPath:'/data',readOnly:false,stackResolution:'unknown'}))]) {
    const f = fixture(); f.body.usageReferences = shape; if (shape === undefined) delete f.body.usageReferencesStatus;
    f.body.hiddenCount = 999; f.body.hostPath = '/PRIVATE_HOST';
    const result = await f.engine.execute('get_resource', {resourceRef:f.ref}); assert.equal(result.status, 'succeeded');
    assert.equal(result.usageReferences.availability, 'unknown'); assert.equal(result.usageReferences.limit,50);
    assert.equal(result.usageReferences.items.length, shape?.length || 0); assert.doesNotMatch(JSON.stringify(result), /hiddenCount|999|PRIVATE_HOST|containerId/);
    assert.match(result.nextStep,/retain the native removal checks/);
    assert.equal((await f.engine.execute('preview_resource_change',{resourceType:'volume',operation:'remove',targetRef:f.ref,parameters:{}})).code,'INVALID_INPUT');
  }
  assert.equal(COMMANDS.length,12);
});

test('volume malformed or oversized projections, stale in-flight context and raw target inputs fail closed without output leakage', async () => {
  for (const alter of [f => {f.body.usageReferencesStatus='complete';},f => {f.body.usageReferences=Array(51).fill(f.body.usageReferences[0]);},
    f => {f.body.usageReferences[0].hostPath='/PRIVATE_HOST';},f => {f.body.usageReferences[0].readOnly='false';},
    f => {f.body.usageReferences[0].stackResolution='unknown';},f => {f.body.usageReferences[0].containerId='../PRIVATE';}]) {
    const f=fixture();alter(f);const result=await f.engine.execute('get_resource',{resourceRef:f.ref});assert.equal(result.code,'INVALID_RESPONSE');assert.doesNotMatch(JSON.stringify(result),/PRIVATE|INTERNAL_CONTAINER|Blue/);
  }
  const race=fixture();race.mutate(()=>{race.snapshot.generation='g2';});const result=await race.engine.execute('get_resource',{resourceRef:race.ref});assert.ok(['CONTEXT_CHANGED','STALE_REFERENCE'].includes(result.code));assert.equal(result.usageReferences,undefined);
  const raw=fixture();assert.equal((await raw.engine.execute('get_resource',{resourceRef:'INTERNAL_CONTAINER_11'})).code,'STALE_REFERENCE');assert.equal(raw.requests.length,0);
});
