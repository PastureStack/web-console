import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));
const id = 'aichange-11111111-1111-1111-1111-111111111111';
function fixture(transportKind = 'stdio') {
  const snapshot = {generation: 'g1', accountId: 'principal', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/service'};
  const context = new CommandContext(() => snapshot, (() => { let n = 0; return () => String(++n); })()); context.setMode('enabled');
  const requests = [], audits = [], faults = {}, rows = ['Blue', 'Green'].map((stackName, i) => ({id: `lb-${i}`, accountId: 'p1', name: 'shared',
    stackId: `stack-${i}`, stackName, description: '', state: 'active', data: {secret: 'PRIVATE-CANARY'}, lbConfig: {secret: 'PRIVATE-CANARY'}}));
  let plan, dispatches = 0;
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, wait: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: `a${audits.length}`}; }, request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'loadBalancerService',
        data: request.data.resourceId ? rows.filter(row => row.id === request.data.resourceId) : rows}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (faults.preview) throw faults.preview;
        const {resourceType, operation, resourceId, parameters} = request.data, row = rows.find(item => item.id === resourceId);
        plan = {id, resourceType, operation, resourceId, targetPath: `Environment / ${row.stackName} / ${row.name}`,
          changes: Object.entries(parameters).map(([field, after]) => ({field, before: row[field], after})),
          confirmationState: 'pending', status: 'preview', verifiedResult: false, expiresAt: '2026-11-06T00:00:00Z'};
        return {body: {...plan}};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}}; dispatches++; plan.status = 'accepted';
        if (faults.apply) throw faults.apply;
        return {body: {...plan}};
      }
      if (request.url.endsWith(id)) return {body: {...plan}};
      throw Error('Unexpected fixed route');
    }});
  return {engine, context, snapshot, requests, audits, faults, plan: () => plan, dispatches: () => dispatches};
}

test('LB metadata: browser and stdio choose distinct same-name Stack refs and retain human approval and one dispatch', async () => {
  for (const transport of ['browser', 'stdio']) {
    const f = fixture(transport), found = await f.engine.execute('find_resources', {family: 'load-balancer', query: 'shared'});
    assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
    assert.match(found.items[0].displayPath, /Blue/); assert.match(found.items[1].displayPath, /Green/);
    assert.equal(JSON.stringify(found).includes('PRIVATE-'), false); assert.equal(JSON.stringify(found).includes('lb-1'), false);
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'loadBalancerService', operation: 'update_metadata',
      targetRef: found.items[1].resourceRef, parameters: {name: 'renamed', description: ''}});
    assert.equal(preview.status, 'needs_user'); assert.equal(f.requests.at(-1).data.resourceId, 'lb-1');
    assert.deepEqual(f.requests.at(-1).data.parameters, {name: 'renamed', description: ''});
    assert.match(preview.displayPath, /Green/); assert.equal(JSON.stringify(preview).includes('lb-1'), false);
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER'); assert.equal(f.dispatches(), 0);
    await f.engine.confirmPlan(preview.planRef);
    const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef}); assert.equal(accepted.status, 'accepted');
    f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
    const receipt = await f.engine.execute('get_operation', {operationRef: accepted.operationRef}); assert.equal(receipt.verifiedResult, true);
    assert.equal(f.dispatches(), 1); assert.ok(f.audits.some(event => event.phase === 'result'));
    assert.ok(f.requests.every(request => request.method !== 'PUT' && !request.url.includes('/loadBalancerServices')));
  }
});

test('LB metadata: configuration lifecycle raw-ID and stale-context inputs cannot reach a business plan', async () => {
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
  const input = {resourceType: 'loadBalancerService', operation: 'update_metadata', targetRef: found.items[0].resourceRef};
  const before = f.requests.length;
  for (const field of ['lbConfig', 'portRules', 'certificateIds', 'image', 'scale', 'action', 'data', 'launchConfig', 'stackId'])
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {[field]: 'PRIVATE-CANARY'}})).code, 'INVALID_INPUT');
  for (const operation of ['create', 'start', 'stop', 'restart', 'scale', 'remove', 'archive', 'restore'])
    assert.equal((await f.engine.execute('preview_resource_change', {...input, operation, parameters: {name: 'x'}})).code, 'INVALID_INPUT');
  assert.equal((await f.engine.execute('preview_resource_change', {...input, targetRef: 'lb-0', parameters: {name: 'x'}})).code, 'STALE_REFERENCE');
  f.snapshot.projectId = 'foreign'; f.snapshot.schemaProjectId = 'foreign';
  const stale = await f.engine.execute('preview_resource_change', {...input, parameters: {name: 'x'}});
  assert.equal(stale.code, 'STALE_REFERENCE'); assert.equal(f.requests.length, before); assert.equal(f.dispatches(), 0);
});

test('LB metadata: forbidden Stack or stale plan remains rejected and uncertain apply observes without replay', async () => {
  for (const [status, code, expected] of [[403, 'KeyScopeDenied', 'FORBIDDEN'], [409, 'ResourceChangePlanStale', 'CONFLICT']]) {
    const f = fixture(), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
    f.faults.preview = {status, body: {code, message: 'PRIVATE-CANARY'}};
    const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'loadBalancerService', operation: 'update_metadata',
      targetRef: found.items[0].resourceRef, parameters: {description: ''}});
    assert.equal(rejected.code, expected); assert.equal(f.dispatches(), 0); assert.equal(JSON.stringify(rejected).includes('PRIVATE-'), false);
  }
  const f = fixture(), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'loadBalancerService', operation: 'update_metadata',
    targetRef: found.items[1].resourceRef, parameters: {description: null}});
  await f.engine.confirmPlan(preview.planRef); f.faults.apply = Error('PRIVATE-CANARY');
  const uncertain = await f.engine.execute('apply_resource_change', {planRef: preview.planRef}); assert.equal(uncertain.status, 'unknown');
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  assert.equal((await f.engine.execute('get_operation', {operationRef: uncertain.operationRef})).verifiedResult, true);
  assert.equal(f.requests.filter(request => request.url.endsWith('?action=apply')).length, 1);
});

test('LB metadata: capability and existing thirteen locale labels describe the closed subset and canonical audit target', async () => {
  const f = fixture(), capability = (await f.engine.execute('list_capabilities', {})).families.find(item => item.family === 'load-balancer').resources[0];
  assert.deepEqual(capability.operations, ['start', 'stop', 'scale', 'update_metadata', 'create']);
  const tool = COMMANDS.find(command => command.name === 'preview_resource_change');
  assert.ok(tool.inputSchema.properties.resourceType.enum.includes('loadBalancerService'));
  assert.match(tool.description, /Load-balancer metadata updates still allow only name and description/);
  const yaml = createRequire(import.meta.url)('yamljs');
  const locales = ['de-de', 'en-us', 'fa-ir', 'fil-ph', 'fr-fr', 'ja-jp', 'ko-kr', 'hu-hu', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw'];
  for (const locale of locales) {
    const dictionary = yaml.parse(readFileSync(new URL(`../translations/${locale}.yaml`, import.meta.url), 'utf8'));
    const translated = key => key.split('.').reduce((item, part) => item && item[part], dictionary);
    const labels = resourceReviewLabels({resourceType: 'loadBalancerService', operation: 'update_metadata', displayDiff: [{field: 'name', after: 'safe'}]}, translated);
    assert.equal(labels.resourceTypeLabel, translated('servicePage.type.loadbalancerservice'));
    assert.ok(labels.resourceTypeLabel && !labels.resourceTypeLabel.includes('undefined'), locale);
  }
  const source = readFileSync(new URL('../app/components/api-key-audit/component.js', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  assert.match(source, /safe\.targetType === 'loadBalancerService' \? 'servicePage\.type\.loadbalancerservice'/);
});

test('LB metadata: misplaced root metadata receives a parameters repair and corrected preview still requires a human', async () => {
  for (const transport of ['browser', 'stdio']) for (const first of ['name', 'description']) {
    const f = fixture(transport), found = await f.engine.execute('find_resources', {family: 'load-balancer'});
    const targetRef = found.items[1].resourceRef, parameters = {name: 'renamed', description: 'requested description'};
    const rootFields = first === 'name' ? parameters : {description: parameters.description, name: parameters.name};
    const before = f.requests.length;
    const rejected = await f.engine.execute('preview_resource_change', {resourceType: 'loadBalancerService', operation: 'update_metadata', targetRef, ...rootFields});
    assert.equal(rejected.code, 'INVALID_INPUT'); assert.equal(rejected.field, first);
    assert.match(rejected.nextStep, /name and description inside parameters/);
    assert.match(rejected.nextStep, /same selected targetRef/);
    assert.equal(f.requests.length, before); assert.equal(f.dispatches(), 0); assert.equal(f.plan(), undefined);
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'loadBalancerService', operation: 'update_metadata', targetRef, parameters});
    assert.equal(preview.status, 'needs_user'); assert.equal(preview.confirmationState, 'pending');
    assert.deepEqual(preview.displayDiff, [{field: 'name', before: 'shared', after: parameters.name}, {field: 'description', before: '', after: parameters.description}]);
    assert.equal(f.requests.at(-1).data.resourceId, 'lb-1'); assert.deepEqual(f.requests.at(-1).data.parameters, parameters);
    assert.equal(f.dispatches(), 0); assert.ok(f.requests.every(request => !/[?&]action=(confirm|apply)/.test(request.url)));
    assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
    assert.equal(f.dispatches(), 0); assert.equal(f.plan().confirmationState, 'pending');
    assert.equal(JSON.stringify(rejected).includes('PRIVATE-CANARY'), false);
    const adjacentBefore = f.requests.length;
    for (const resourceType of ['host', 'stack']) {
      for (const field of ['name', 'description']) {
        const adjacent = await f.engine.execute('preview_resource_change', {resourceType, operation: 'update_metadata', targetRef, [field]: 'requested'});
        assert.equal(adjacent.code, 'INVALID_INPUT'); assert.equal(adjacent.field, field);
        assert.match(adjacent.nextStep, /name and description inside parameters/);
      }
      for (const operation of ['start', 'stop', 'remove']) {
        const other = await f.engine.execute('preview_resource_change', {resourceType, operation, targetRef, name: 'requested'});
        assert.equal(other.code, 'INVALID_INPUT');
        assert.doesNotMatch(other.nextStep || '', /name and description inside parameters/);
      }
    }
    assert.equal(f.requests.length, adjacentBefore); assert.equal(f.dispatches(), 0);
  }
});
