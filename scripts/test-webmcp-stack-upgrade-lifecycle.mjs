import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';
const {resourceReviewLabels} = await import('data:text/javascript;base64,' +
  fs.readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));

const operations = ['finish_upgrade', 'rollback', 'cancel_upgrade'];
const starts = {finish_upgrade: ['upgraded'], rollback: ['upgrading', 'upgraded', 'canceled-upgrade'],
  cancel_upgrade: ['upgrading', 'finishing-upgrade']};
const terminal = operation => operation === 'cancel_upgrade' ? 'canceled-upgrade' : 'active';
const planId = 'aichange-22222222-2222-2222-2222-222222222222';

function fixture({operation = 'finish_upgrade', before = starts[operation][0], transportKind = 'stdio',
  statuses = ['succeeded'], verified = true, rejectPreview, mutateChanges, mutateApplyResponse} = {}) {
  const session = {generation: 'generation-one', accountId: 'actor', projectId: 'project', projectName: 'Environment',
    schemaProjectId: 'project', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan, dispatches = 0, current = before;
  const context = new CommandContext(() => session, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], reviews = [], audits = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async () => {},
    onPlan: value => reviews.push(value), audit: async value => { audits.push(value); return {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => {
      requests.push(request);
      const rows = [{id: 'first', accountId: 'project', name: 'same', description: 'first choice', state: before},
        {id: 'selected', accountId: 'project', name: 'same', description: 'second choice', state: current}];
      if (request.url === 'projects/project/stacks?limit=50') return {body: {data: rows}};
      if (request.url === 'projects/project/stacks/selected') return {body: {...rows[1]}};
      if (request.url === 'projects/project/aiResourceViews') {
        return {body: {resourceType: 'stack', data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows, nextMarker: null}};
      }
      if (request.url === 'projects/project/aiResourceChangePlans') {
        if (rejectPreview) throw rejectPreview;
        const changes = [{field: 'operation', before: null, after: operation},
          {field: 'state', before, after: terminal(operation)},
          {field: 'affectedServiceCount', before: 2, after: 2},
          {field: 'checkpointOnly', before: null, after: operation === 'cancel_upgrade'}];
        plan = {id: planId, resourceType: 'stack', operation, resourceId: request.data.resourceId, targetPath: 'Environment/same',
          changes: mutateChanges ? mutateChanges(changes) : changes, status: 'preview', verifiedResult: false, confirmationState: 'pending'};
        return {body: {...plan}};
      }
      if (request.url === 'projects/project/aiResourceChangePlans/' + planId + '?action=apply') {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        if (dispatches === 0) { dispatches++; plan.status = 'accepted'; }
        return {body: mutateApplyResponse ? mutateApplyResponse({...plan}) : {...plan}};
      }
      if (request.url === 'projects/project/aiResourceChangePlans/' + planId) {
        if (dispatches > 0) {
          plan.status = statuses.length > 1 ? statuses.shift() : statuses[0];
          plan.verifiedResult = plan.status === 'succeeded' && verified;
          if (plan.verifiedResult) current = terminal(operation);
        }
        return {body: {...plan}};
      }
      throw new Error('Unexpected Stack lifecycle route');
    }});
  return {engine, session, context, requests, reviews, audits, plan: () => plan, dispatches: () => dispatches,
    humanApprove: () => { plan.confirmationState = 'approved'; }};
}
async function selected(f) {
  const result = await f.engine.execute('find_resources', {family: 'stack', query: 'same'});
  assert(Array.isArray(result.items), JSON.stringify({result, requests: f.requests}));
  assert.equal(result.items.length, 2); assert.notEqual(result.items[0].resourceRef, result.items[1].resourceRef);
  return result.items[1].resourceRef;
}
const preview = (f, operation, targetRef, parameters = {}) => f.engine.execute('preview_resource_change',
  {resourceType: 'stack', operation, targetRef, parameters});

test('Stack upgrade lifecycle: the same twelve tools expose three native actions with empty parameters', async () => {
  assert.equal(COMMANDS.length, 12);
  const tool = COMMANDS.find(value => value.name === 'preview_resource_change');
  const rule = tool.inputSchema.allOf.find(value => value.if?.properties?.operation?.enum?.includes('finish_upgrade'));
  assert.deepEqual(rule.then.properties.resourceType.enum, ['service', 'stack']);
  assert.deepEqual(rule.then.properties.parameters.properties, {});
  assert.equal(rule.then.properties.parameters.additionalProperties, false);
  for (const parameters of [{image: 'other'}, {confirmed: true}, {state: 'active'}, {affectedServiceCount: 0}]) {
    const f = fixture(), ref = await selected(f), result = await preview(f, 'finish_upgrade', ref, parameters);
    assert.equal(result.code, 'INVALID_INPUT'); assert.equal(f.requests.length, 1); assert.equal(f.dispatches(), 0);
    assert.match(result.nextStep, /Stack targetRef and empty parameters/);
    assert.doesNotMatch(result.nextStep, /uses preview_service_upgrade/);
  }
});

test('Stack upgrade lifecycle: duplicate-name choice and the exact Stack checkpoint remain human reviewed in both transports', async () => {
  for (const transportKind of ['browser', 'stdio']) for (const operation of operations) for (const before of starts[operation]) {
    const f = fixture({transportKind, operation, before}), ref = await selected(f), result = await preview(f, operation, ref);
    assert.equal(result.status, 'needs_user');
    assert.deepEqual(result.displayDiff, [{field: 'operation', before: null, after: operation},
      {field: 'state', before, after: terminal(operation)}, {field: 'affectedServiceCount', before: 2, after: 2},
      {field: 'checkpointOnly', before: null, after: operation === 'cancel_upgrade'}]);
    assert.deepEqual(f.requests.at(-1).data, {resourceType: 'stack', operation, resourceId: 'selected', parameters: {}});
    assert.equal(f.reviews.length, 1); assert.equal(f.dispatches(), 0);
    assert.equal(JSON.stringify(result).includes(planId), false);
    assert.equal(JSON.stringify(result).includes('resourceId'), false);
    const unapproved = await f.engine.execute('apply_resource_change', {planRef: result.planRef});
    assert.equal(unapproved.code, 'NEEDS_USER'); assert.equal(f.dispatches(), 0);
    f.humanApprove();
    const accepted = await f.engine.execute('apply_resource_change', {planRef: result.planRef});
    assert.equal(accepted.status, 'accepted');
    const done = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
    assert.equal(done.status, 'succeeded'); assert.equal(done.verifiedResult, true); assert.equal(f.dispatches(), 1);
    if (operation === 'cancel_upgrade') {
      assert.match(done.nextStep, /Stack.*checkpoint/i); assert.match(done.nextStep, /service/i);
    }
    assert.equal(f.requests.some(request => request.method === 'DELETE' || /stacks\/.*action=/.test(request.url)), false);
  }
});

test('Stack upgrade lifecycle: incomplete, forged and duplicate impact fields are rejected before approval', async () => {
  const cases = [
    rows => rows.slice(0, 2),
    rows => rows.filter(row => row.field !== 'checkpointOnly'),
    rows => [...rows, {...rows[2]}],
    rows => rows.map(row => row.field === 'affectedServiceCount' ? {...row, before: -1, after: -1} : row),
    rows => rows.map(row => row.field === 'affectedServiceCount' ? {...row, after: 3} : row),
    rows => rows.map(row => row.field === 'affectedServiceCount' ? {...row, before: 1.5, after: 1.5} : row),
    rows => rows.map(row => row.field === 'checkpointOnly' ? {...row, after: true} : row),
    rows => rows.map(row => row.field === 'state' ? {...row, after: 'removed'} : row),
    rows => [...rows, {field: 'composeConfig', before: null, after: 'PRIVATE_CONFIG'}],
  ];
  for (const mutateChanges of cases) {
    const f = fixture({mutateChanges}), ref = await selected(f), result = await preview(f, 'finish_upgrade', ref);
    assert.equal(result.code, 'INVALID_RESPONSE'); assert.equal(f.reviews.length, 0); assert.equal(f.dispatches(), 0);
    assert.equal(JSON.stringify(result).includes('PRIVATE_CONFIG'), false);
  }
});

test('Stack upgrade lifecycle: changed impact review and changed session never dispatch an approved old plan', async () => {
  for (const change of ['review', 'session']) {
    const f = fixture(), ref = await selected(f), result = await preview(f, 'finish_upgrade', ref);
    assert.equal(result.status, 'needs_user'); f.humanApprove();
    if (change === 'review') f.plan().changes = f.plan().changes.map(row => row.field === 'affectedServiceCount' ? {...row, before: 3, after: 3} : row);
    else f.session.generation = 'generation-two';
    const applied = await f.engine.execute('apply_resource_change', {planRef: result.planRef});
    assert(['CONFLICT', 'STALE_REFERENCE', 'CONTEXT_CHANGED'].includes(applied.code), JSON.stringify(applied));
    assert.equal(f.dispatches(), 0);
  }
});

test('Stack upgrade lifecycle: native denial and unverified checkpoints never become success or repeat dispatch', async () => {
  const denied = fixture({rejectPreview: {status: 403, body: {code: 'PermissionDenied'}}}), ref = await selected(denied);
  assert.equal((await preview(denied, 'finish_upgrade', ref)).code, 'FORBIDDEN');
  assert.equal(denied.dispatches(), 0);
  const f = fixture({statuses: ['succeeded'], verified: false}), targetRef = await selected(f);
  const pending = await preview(f, 'finish_upgrade', targetRef); assert.equal(pending.status, 'needs_user'); f.humanApprove();
  const accepted = await f.engine.execute('apply_resource_change', {planRef: pending.planRef});
  const result = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.notEqual(result.status === 'succeeded' && result.verifiedResult === true, true);
  await f.engine.execute('apply_resource_change', {planRef: pending.planRef});
  assert.equal(f.dispatches(), 1);
});

test('Stack upgrade lifecycle: localized review separates total services, cancellation checkpoint and immutable native values', () => {
  for (const operation of operations) for (const before of starts[operation]) {
    const plan = {resourceType: 'stack', operation, displayDiff: [{field: 'operation', before: null, after: operation},
      {field: 'state', before, after: terminal(operation)}, {field: 'affectedServiceCount', before: 2, after: 2},
      {field: 'checkpointOnly', before: null, after: operation === 'cancel_upgrade'}]};
    const original = JSON.stringify(plan), labels = resourceReviewLabels(plan, key => 'TEXT:' + key);
    const count = labels.displayChanges.find(row => row.field === 'affectedServiceCount');
    assert.equal(count.fieldLabel, 'TEXT:webmcp.stackServiceCount'); assert.equal(count.informational, true);
    assert.equal(count.after, '2');
    const checkpoint = labels.displayChanges.find(row => row.field === 'checkpointOnly');
    assert.equal(checkpoint.fieldLabel, 'TEXT:webmcp.checkpointOnly'); assert.equal(checkpoint.informational, true);
    assert.equal(Boolean(labels.stackCancelCheckpointNotice), operation === 'cancel_upgrade');
    assert(labels.displayChanges.find(row => row.field === 'state').before.startsWith('TEXT:'));
    assert.equal(JSON.stringify(plan), original);
    const service = resourceReviewLabels({...plan, resourceType: 'service', displayDiff: plan.displayDiff.slice(0, 2)}, key => 'TEXT:' + key);
    assert.equal(service.stackCancelCheckpointNotice, null);
  }
});

test('Stack upgrade lifecycle: all thirteen locales have complete native-language checkpoint and phase copy', () => {
  const root = new URL('../translations/', import.meta.url);
  const locales = fs.readdirSync(root).filter(name => name.endsWith('.yaml') && name !== 'none.yaml');
  assert.equal(locales.length, 13);
  const keys = ['stackServiceCount', 'checkpointOnly', 'stackCancelCheckpointNotice', 'upgradeCancelledState', 'finishingUpgradeState'];
  const values = new Map();
  for (const locale of locales) {
    const lines = fs.readFileSync(new URL(locale, root), 'utf8').split(/\r?\n/), start = lines.indexOf('webmcp:');
    assert(start >= 0, locale);
    const body = [];
    for (let index = start + 1; index < lines.length; index++) {
      if (/^[^\s#]/.test(lines[index])) break;
      body.push(lines[index]);
    }
    const row = {};
    for (const key of keys) {
      const entries = body.filter(line => line.startsWith('  ' + key + ': '));
      assert.equal(entries.length, 1, locale + ':' + key);
      row[key] = JSON.parse(entries[0].slice(('  ' + key + ': ').length));
      assert.equal(typeof row[key], 'string'); assert(row[key].trim().length > 0);
      assert(!/Missing translation|undefined|\{[^}]*\}/.test(row[key]), locale + ':' + key);
    }
    values.set(locale, row);
  }
  for (const [locale, row] of values) if (locale !== 'en-us.yaml') {
    for (const key of keys) assert.notEqual(row[key], values.get('en-us.yaml')[key], locale + ':' + key);
  }
  assert(/[\u0600-\u06ff]/.test(values.get('fa-ir.yaml').stackCancelCheckpointNotice));
});

test('Stack upgrade lifecycle: an invalid post-submit review retains the original operation for read-only recovery', async () => {
  for (const mutateApplyResponse of [plan => ({...plan, changes: plan.changes.map(row =>
    row.field === 'affectedServiceCount' ? {...row, before: 3, after: 3} : row)}), () => null, () => '<invalid-body>']) {
  const f = fixture({mutateApplyResponse});
  const ref = await selected(f), pending = await preview(f, 'finish_upgrade', ref); f.humanApprove();
  const result = await f.engine.execute('apply_resource_change', {planRef: pending.planRef});
  assert.equal(f.dispatches(), 1); assert.equal(result.status, 'unknown'); assert.equal(result.code, 'UNKNOWN_RESULT');
  assert.equal(typeof result.operationRef, 'string');
  const recovered = await f.engine.execute('get_operation', {operationRef: result.operationRef});
  assert.equal(recovered.status, 'succeeded'); assert.equal(recovered.verifiedResult, true); assert.equal(f.dispatches(), 1);
  }
});
