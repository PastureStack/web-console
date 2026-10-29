import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const privateText = 'RAW_PRIVATE_SERVICE_CONFIG_MUST_NOT_LEAVE';
function fixture(error) {
  const snapshot = {generation: 'g1', accountId: 'actor', projectId: 'project', schemaProjectId: 'project', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], audits = [];
  const engine = new CommandEngine({context, ensureSession: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => { requests.push(request); throw error; }});
  const captured = context.capture();
  const targetRef = context.reference('resource', {id: 'service-one', family: 'service', resourceType: 'service', scope: 'project'}, captured);
  const planRef = context.reference('plan', {id: 'aichange-11111111-1111-1111-1111-111111111111', planKind: 'resource-change',
    resourceType: 'service', operation: 'scale', resourceId: 'service-one'}, captured);
  return {engine, context, requests, audits, targetRef, planRef};
}
const unsupported = () => ({status: 422, body: {code: 'ResourceChangeUnsupported', message: privateText}});
function assertUnsupported(result) {
  assert.equal(result.code, 'UNAVAILABLE'); assert.equal(result.status, 'rejected');
  assert.match(result.nextStep, /Global services deploy according to eligible hosts/);
  assert.match(result.nextStep, /do not support a manual instance count/);
  assert.match(result.nextStep, /Do not retry the same plan/);
  assert.match(result.nextStep, /do not guess another scale value/);
  assert.equal(JSON.stringify(result).includes(privateText), false);
}

test('manual scale: authoritative unsupported preview remains rejected and explains Global eligible-host deployment', async () => {
  const f = fixture(unsupported());
  const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'scale', targetRef: f.targetRef, parameters: {scale: 2}});
  assertUnsupported(result);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.requests[0].data, {resourceType: 'service', operation: 'scale', resourceId: 'service-one', parameters: {scale: 2}});
  assert.deepEqual(f.audits.map(event => [event.phase, event.status, event.reason]), [['start', 'pending', 'NONE'], ['result', 'rejected', 'UNAVAILABLE']]);
});

test('manual scale: an existing legacy Global plan rejected at apply is not an unknown write and is never retried', async () => {
  const f = fixture(unsupported());
  const result = await f.engine.execute('apply_resource_change', {planRef: f.planRef});
  assertUnsupported(result);
  assert.equal(f.requests.length, 1); assert.match(f.requests[0].url, /\?action=apply$/);
  assert.deepEqual(f.requests[0].data, {});
  const reference = f.context.resolve(f.planRef, 'plan', f.context.capture());
  assert.equal(f.context.resolve(reference.operationRef, 'operation', f.context.capture()).lastStatus, 'rejected');
});

test('manual scale: changed-snapshot conflict, permission denial, feature-off and unknown transport retain their exact categories', async () => {
  for (const [error, code, status] of [
    [{status: 409, body: {code: 'ResourceChangePlanStale'}}, 'CONFLICT', 'rejected'],
    [{status: 403, body: {code: 'ResourceChangeUnsupported'}}, 'FORBIDDEN', 'rejected'],
    [{status: 503, body: {code: 'ResourceChangeFeatureDisabled'}}, 'UNAVAILABLE', 'rejected'],
    [{status: 503, body: {code: 'ResourceChangeUnsupported'}}, 'UNKNOWN_RESULT', 'unknown'],
    [new Error(privateText), 'UNKNOWN_RESULT', 'unknown'],
  ]) {
    const f = fixture(error);
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'scale', targetRef: f.targetRef, parameters: {scale: 2}});
    assert.equal(result.code, code); assert.equal(result.status, status);
    assert.equal(result.nextStep.includes('Global services'), false);
    assert.equal(f.requests.length, 1); assert.equal(JSON.stringify(result).includes(privateText), false);
  }
});
