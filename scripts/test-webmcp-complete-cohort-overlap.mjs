import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';

test('complete cohort keeps logs view, Volume create and typed Service configuration in the same twelve-tool contract', () => {
  assert.equal(COMMANDS.length, 12);
  const get = COMMANDS.find(x => x.name === 'get_resource');
  assert.deepEqual(get.inputSchema.properties.view.enum, ['stack_graph', 'container_logs']);
  assert.equal(get.inputSchema.properties.tailLines.maximum, 200);
  const change = COMMANDS.find(x => x.name === 'preview_resource_change');
  const volume = change.inputSchema.allOf.find(x => x.if.properties.resourceType?.const === 'volume');
  assert.equal(volume.then.properties.operation.const, 'create');
  assert.deepEqual(Object.keys(volume.then.properties.parameters.properties), ['name', 'description']);
  assert.ok(change.description.includes('volume'));
  const upgrade = COMMANDS.find(x => x.name === 'preview_service_upgrade');
  assert.ok(upgrade.inputSchema.properties.ports);
  assert.ok(upgrade.inputSchema.properties.healthCheck);
  assert.match(get.description, /arbitrary application secrets may remain/);
  assert.match(get.description, /Usage completeness is always unknown/);
});

test('a Volume usage containerRef can read bounded logs while view and tail options stay target-specific', async () => {
  const state = {generation:'g', accountId:'actor', projectId:'p1', schemaProjectId:'p1', schemaGeneration:1, route:'/storagepools'};
  let sequence = 0;
  const context = new CommandContext(() => state, () => String(++sequence)); context.setMode('enabled');
  const captured = context.capture(), calls = [];
  const volumeRef = context.reference('resource', {id:'v1', family:'storage', resourceType:'volume', scope:'project'}, captured);
  const engine = new CommandEngine({context, ensureSession:async () => {}, audit:async () => ({accepted:true, requestId:'audit'}),
    request:async request => {
      calls.push(request);
      if (request.data?.resourceType === 'volume') return {body:{resourceType:'volume', nextMarker:null, data:[{
        id:'v1', type:'volume', accountId:'p1', name:'data', state:'detached', driver:'local', usageReferencesStatus:'unknown',
        usageReferences:[{containerId:'c1', name:'same', state:'running', mountPath:'/data', readOnly:true, stackResolution:'resolved', stackName:'Stack A'}]}]}};
      assert.equal(request.data?.view, 'container_logs'); assert.equal(request.data.resourceId, 'c1');
      return {body:{resourceType:'container', nextMarker:null, data:[{id:'c1', type:'container', accountId:'p1', logs:{
        text:'untrusted application line', truncated:false, completeness:'unknown', stopReason:'eof', resourceTextIsUntrusted:true,
        redaction:'known-request-secrets-and-sensitive-key-patterns-only'}}]}};
    }});
  const volume = await engine.execute('get_resource', {resourceRef:volumeRef});
  assert.equal(volume.status, 'succeeded'); assert.equal(volume.usageReferences.availability, 'unknown');
  const resourceRef = volume.usageReferences.items[0].containerRef;
  assert.ok(resourceRef); assert.equal(volume.usageReferences.items[0].readOnly, true);
  const logs = await engine.execute('get_resource', {resourceRef, view:'container_logs', tailLines:200});
  assert.equal(logs.status, 'succeeded'); assert.equal(logs.logs.completeness, 'unknown');
  assert.equal(logs.logs.text, 'untrusted application line'); assert.equal(logs.usageReferences, undefined);
  assert.equal(calls[0].data.tailLines, undefined); assert.equal(calls[1].data.tailLines, 200);
  const count = calls.length;
  assert.equal((await engine.execute('get_resource', {resourceRef:volumeRef, view:'container_logs'})).code, 'INVALID_INPUT');
  assert.equal((await engine.execute('get_resource', {resourceRef, tailLines:20})).code, 'INVALID_INPUT');
  assert.equal(calls.length, count);
});
