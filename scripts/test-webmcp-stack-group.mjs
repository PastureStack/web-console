import YAML from 'yamljs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
import {resourceReviewLabels} from '../app/utils/ai-resource-review-labels.js';

function fixture(transportKind = 'browser', mutate) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const captured = context.capture(), targetRef = context.reference('resource', {id: '1st7', resourceType: 'stack', scope: 'project'}, captured);
  const requests = [], audits = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'r1'}; }, request: async request => {
      requests.push(request);
      if (request.method === 'POST' && request.url.endsWith('aiResourceChangePlans')) {
        plan = {id: 'aichange-00000000-0000-4000-8000-000000000007', resourceType: 'stack', resourceId: '1st7', operation: 'update_metadata',
          targetPath: 'Environment / ordinary', status: 'preview', confirmationState: 'pending', verifiedResult: false, expiresAt: '2027-01-01T00:00:00Z',
          changes: Object.entries(request.data.parameters).map(([field, after]) => ({field, before: field === 'group' ? 'Old, Mixed CASE' : null, after}))};
        if (mutate) mutate(plan);
        return {body: plan};
      }
      if (request.method === 'GET') return {body: plan};
      if (request.url.endsWith('?action=apply')) throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
      throw new Error('Unexpected native mutation');
    }});
  return {engine, context, captured, targetRef, requests, audits, plan: () => plan};
}

test('Stack group browser and stdio previews preserve raw multi-tag text null and empty through the normal plan owner', async () => {
  for (const transport of ['browser', 'stdio']) for (const group of ['  Blue ,Mixed CASE,,  ', '', null]) {
    const f = fixture(transport);
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'update_metadata', targetRef: f.targetRef, parameters: {group}});
    assert.equal(result.code, undefined, JSON.stringify(result)); assert.equal(result.displayDiff[0].after, group);
    assert.equal(f.requests.find(r => r.method === 'POST').data.parameters.group, group);
    assert.equal(f.requests.filter(r => r.method !== 'GET').length, 1);
    const labels = resourceReviewLabels(result, key => key);
    assert.equal(labels.displayChanges[0].fieldLabel, 'editStack.group.label');
  }
});
test('Stack group remains closed to other workflows invalid types overflow and NUL before any request', async () => {
  const schema = COMMANDS.find(c => c.name === 'preview_resource_change').inputSchema.properties.parameters.properties.group;
  assert.deepEqual(schema.type, ['string', 'null']); assert.equal(schema.maxLength, 255); assert.equal(schema.minLength, 0);
  for (const [type, operation, group] of [['service', 'update_metadata', 'Blue'], ['stack', 'create', 'Blue'],
    ['stack', 'update_metadata', ['Blue']], ['stack', 'update_metadata', 1], ['stack', 'update_metadata', 'x'.repeat(256)], ['stack', 'update_metadata', 'bad\0tag']]) {
    const f = fixture(); const result = await f.engine.execute('preview_resource_change', {resourceType: type, operation, targetRef: f.targetRef, parameters: {group}});
    assert.equal(result.code, 'INVALID_INPUT'); assert.equal(f.requests.length, 0);
  }
});
test('Stack group rejects misleading duplicate wrong-family or rewritten review and keeps human approval mandatory', async () => {
  for (const mutate of [p => {p.changes[0].after = 'normalized';}, p => {p.changes.push({...p.changes[0]});}, p => {p.changes[0].after = true;}]) {
    const f = fixture('browser', mutate), result = await f.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'update_metadata', targetRef: f.targetRef, parameters: {group: ' Exact '}});
    assert.equal(result.code, 'INVALID_RESPONSE');
  }
  const incomplete = fixture('browser', p => {p.changes[2] = {...p.changes[1]};});
  const incompleteResult = await incomplete.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'update_metadata',
    targetRef: incomplete.targetRef, parameters: {group: 'Blue', name: 'new', description: 'new description'}});
  assert.equal(incompleteResult.code, 'INVALID_RESPONSE');
  const f = fixture(), result = await f.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'update_metadata', targetRef: f.targetRef, parameters: {group: ' Exact '}});
  const apply = await f.engine.execute('apply_resource_change', {planRef: result.planRef});
  assert.equal(apply.code, 'NEEDS_USER'); assert.equal(f.requests.filter(r => r.url.includes('action=apply')).length, 1);
  f.plan().changes[0].after = 'different';
  const drift = await f.engine.execute('apply_resource_change', {planRef: result.planRef});
  assert.equal(drift.code, 'CONFLICT'); assert.equal(f.requests.filter(r => r.url.includes('action=apply')).length, 1);
  assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), resourceType: 'service'}, null));
});

const webRoot = new URL('../', import.meta.url);
test('Stack Group review reuses the existing native Group label in all thirteen locales without modifying program text', () => {
  for (const locale of ['en-us', 'zh-tw', 'zh-hans', 'de-de', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua']) {
    const translations = YAML.load(new URL('translations/' + locale + '.yaml', webRoot).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    const label = translations.editStack.group.label; assert.equal(typeof label, 'string'); assert.ok(label.trim());
    const plan = {resourceType: 'stack', operation: 'update_metadata', displayDiff: [{field: 'group', before: null, after: '  Blue, Mixed CASE '}]};
    const before = JSON.stringify(plan), review = resourceReviewLabels(plan, key => key === 'editStack.group.label' ? label : key);
    assert.equal(review.displayChanges[0].fieldLabel, label); assert.equal(JSON.stringify(plan), before);
  }
});
