import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';

const planId = 'aichange-11111111-1111-1111-1111-111111111111';
const secret = 'ARCHIVE_PRIVATE_MESSAGE_MUST_NOT_LEAVE';
function fixture({resourceType = 'service', operation = 'archive', before = false, rejectPreview} = {}) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan, targetArchived = before;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], audits = [], published = [];
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {}, wait: async () => {}, onPlan: value => published.push(value),
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') {
        return {body: {resourceType: request.data.resourceType, data: [{id: 'one', name: 'same', archived: false, stackId: 'alpha', stackName: 'Alpha'},
          {id: 'two', name: 'same', archived: targetArchived, stackId: 'beta', stackName: 'Beta'}]}};
      }
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (rejectPreview) throw rejectPreview;
        plan = {id: planId, resourceType, operation, resourceId: request.data.resourceId, targetPath: 'Environment/Beta/same',
          changes: [{field: 'archived', before, after: operation === 'archive'}], confirmationState: 'pending', status: 'preview', expiresAt: '2026-10-30T12:00:00Z', verifiedResult: false};
        return {body: {...plan}};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=confirm`) {
        plan.confirmationState = 'approved'; return {body: {...plan}};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=apply`) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        plan.status = 'accepted'; return {body: {...plan}};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}`) {
        plan.status = 'succeeded'; plan.verifiedResult = true; targetArchived = operation === 'archive'; return {body: {...plan}};
      }
      throw Error('Unexpected fixed archive test path');
    },
  });
  return {engine, context, requests, audits, published, snapshot};
}
async function target(f, resourceType = 'service') {
  return (await f.engine.execute('find_resources', {family: resourceType, query: 'same'})).items[1].resourceRef;
}

test('archive tools: existing typed preview provides only stack/service archive and restore with no raw archive flag input', () => {
  assert.equal(COMMANDS.length, 12);
  const preview = COMMANDS.find(item => item.name === 'preview_resource_change');
  assert.ok(preview.inputSchema.properties.operation.enum.includes('archive'));
  assert.ok(preview.inputSchema.properties.operation.enum.includes('restore'));
  assert.equal('archived' in preview.inputSchema.properties.parameters.properties, false);
  assert.match(preview.description, /completely stopped/); assert.match(preview.description, /does not start/);
});

test('archive tools: exact requests preserve selected duplicate refs and submit only an empty parameter object', async () => {
  for (const resourceType of ['stack', 'service']) for (const operation of ['archive', 'restore']) {
    const f = fixture({resourceType, operation, before: operation === 'restore'});
    const found = await f.engine.execute('find_resources', {family: resourceType, query: 'same'});
    assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
    assert.equal(found.items[1].fields.archived, operation === 'restore');
    const preview = await f.engine.execute('preview_resource_change', {resourceType, operation, targetRef: found.items[1].resourceRef, parameters: {}});
    assert.equal(preview.status, 'needs_user'); assert.equal(preview.displayPath, 'Environment/Beta/same');
    assert.deepEqual(preview.displayDiff, [{field: 'archived', before: operation === 'restore', after: operation === 'archive'}]);
    assert.deepEqual(f.requests[1].data, {resourceType, operation, resourceId: 'two', parameters: {}});
    assert.equal(f.requests[1].method, 'POST'); assert.equal(f.published.length, 1);
    assert.ok(f.requests.every(request => request.method === 'POST'));
    assert.equal(JSON.stringify(preview).includes('resourceId'), false);
    assert.equal(JSON.stringify(f.audits).includes('archived'), false);
  }
});

test('archive tools: reject cascading flags, auto-stop, full DTOs, wrong types and raw targets before preview', async () => {
  const f = fixture(), ref = await target(f);
  for (const input of [
    {parameters: {archived: true}}, {parameters: {stopFirst: true}}, {parameters: {cascade: true}}, {parameters: {name: 'copy'}},
    {resourceId: 'two'}, {resourceType: 'container'}, {targetRef: 'two'}, {parentRef: ref},
  ]) {
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'archive', targetRef: ref, ...input});
    assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code));
  }
  assert.equal(f.requests.length, 1); assert.equal(f.published.length, 0);
});

test('archive tools: safe diff requires a single exact boolean archive field and permits ordinary idempotence', () => {
  const f = fixture();
  const plan = {id: planId, resourceType: 'service', operation: 'archive', targetPath: 'Environment/Beta/same', confirmationState: 'pending',
    changes: [{field: 'archived', before: false, after: true}]};
  for (const changes of [[], [{field: 'archived', before: null, after: true}], [{field: 'archived', before: false, after: 'true'}],
    [{field: 'archived', before: false, after: false}], [{field: 'state', before: 'active', after: 'inactive'}],
    [...plan.changes, {field: 'state', before: 'active', after: 'inactive'}]]) {
    assert.throws(() => f.engine.resourcePlanSummary({...plan, changes}), error => error.code === 'INVALID_RESPONSE');
  }
  assert.deepEqual(f.engine.resourcePlanSummary({...plan, changes: [{field: 'archived', before: true, after: true}]}, 'opaque').displayDiff,
    [{field: 'archived', before: true, after: true}]);
  assert.deepEqual(f.engine.resourcePlanSummary({...plan, operation: 'restore', changes: [{field: 'archived', before: false, after: false}]}, 'opaque').displayDiff,
    [{field: 'archived', before: false, after: false}]);
  assert.throws(() => f.engine.resourcePlanSummary({...plan, operation: 'update_metadata'}), error => error.code === 'INVALID_RESPONSE');
});

test('archive tools: restore keeps the same approved target plan and never sends parent child or start operations', async () => {
  for (const resourceType of ['stack', 'service']) {
    const f = fixture({resourceType, operation: 'restore', before: true}), ref = await target(f, resourceType);
    const preview = await f.engine.execute('preview_resource_change', {resourceType, operation: 'restore', targetRef: ref});
    const unapproved = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    assert.equal(unapproved.code, 'NEEDS_USER');
    await f.engine.confirmPlan(preview.planRef);
    const applied = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    assert.equal(applied.status, 'accepted');
    const completed = await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(completed.status, 'succeeded'); assert.equal(completed.verifiedResult, true);
    assert.deepEqual(f.requests[1].data, {resourceType, operation: 'restore', resourceId: 'two', parameters: {}});
    assert.ok(f.requests.slice(2).every(request => request.url.startsWith(`projects/p1/aiResourceChangePlans/${planId}`)));
    assert.ok(f.requests.filter(request => request.url.includes('?action=apply')).every(request => Object.keys(request.data).length === 0));
    assert.equal(JSON.stringify(f.requests).includes('activateservices'), false);
    assert.equal(f.requests.filter(request => request.url === 'projects/p1/aiResourceChangePlans').length, 1);
  }
});

test('archive tools: exact eligibility and parent errors repair safely without auto-stop retries or permission changes', async () => {
  for (const [status, serverCode, code, instruction] of [
    [422, 'ArchiveRequiresStopped', 'CONFLICT', /Do not automatically stop anything or retry archive/],
    [422, 'ArchiveSystemResource', 'UNAVAILABLE', /does not prohibit restoring/],
    [422, 'ArchiveMixedUpdate', 'INVALID_INPUT', /empty parameters/],
    [409, 'ArchiveConcurrentChange', 'CONFLICT', /target and its parent again/],
    [409, 'ResourceArchived', 'CONFLICT', /never restores children or parents automatically/],
    [403, 'ArchiveRequiresStopped', 'FORBIDDEN', /Do not try another ID/],
    [503, 'ArchiveRequiresStopped', 'UNKNOWN_RESULT', /unknown/],
  ]) {
    const f = fixture({rejectPreview: {status, body: {code: serverCode, message: secret}}}), ref = await target(f);
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'archive', targetRef: ref});
    assert.equal(result.code, code, serverCode); assert.match(result.nextStep, instruction);
    assert.equal(f.requests.length, 2); assert.equal(f.published.length, 0);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(f.requests.filter(request => request.url === 'projects/p1/aiResourceChangePlans').length, 1);
    assert.ok(!f.requests.some(request => request.url.includes('?action=')));
  }
});
