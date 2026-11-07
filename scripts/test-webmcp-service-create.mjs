import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';

const planId = 'aichange-11111111-1111-1111-1111-111111111111';
const privateText = 'PRIVATE_NATIVE_PAYLOAD_MUST_NOT_LEAVE';
const healthCheck = {port: 80, requestLine: 'GET /health HTTP/1.0', responseTimeout: 2000, interval: 2000,
  healthyThreshold: 2, unhealthyThreshold: 3, initializingTimeout: 60000, reinitializingTimeout: 60000};
const parameters = {name: 'web', image: 'nginx:1.28', ports: ['8080:80/tcp', '53:53/udp'], healthCheck};
function fixture({rejectPreview, omitReviewField, mode = 'enabled', resourceType = 'service'} = {}) {
  const snapshot = {generation: 'g1', accountId: 'actor', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0, plan, dispatches = 0;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode(mode);
  const requests = [], audits = [], published = [];
  const engine = new CommandEngine({context, transportKind: 'stdio', ensureSession: async () => {}, wait: async () => {}, onPlan: value => published.push(value),
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => {
      requests.push(request);
      if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: 'stack', data: [
        {id: 'first-stack', name: 'same'}, {id: 'selected-stack', name: 'same'},
      ]}};
      if (request.url === 'projects/p1/aiResourceChangePlans') {
        if (rejectPreview) throw rejectPreview;
        const fields = request.data.parameters;
        const changes = [{field: 'name', before: null, after: fields.name}, {field: 'startOnCreate', before: null, after: false}];
        if (resourceType === 'container') for (const field of ['image', 'description', 'command', 'entryPoint']) {
          if (Object.hasOwn(fields, field)) changes.push({field, before: null,
            after: Array.isArray(fields[field]) ? JSON.stringify(fields[field]) : fields[field]});
        }
        for (const field of ['ports', 'healthCheck']) if (Object.hasOwn(fields, field) && omitReviewField !== field) {
          changes.push({field, before: null, after: JSON.stringify(field === 'healthCheck' ? {...fields[field], strategy: fields[field].strategy || 'recreate'} : fields[field])});
        }
        plan = {id: planId, resourceType, operation: 'create', resourceId: null, targetPath: 'Environment/same/web', changes,
          confirmationState: 'pending', status: 'preview', expiresAt: '2026-11-01T12:00:00Z'};
        return {body: structuredClone(plan)};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=confirm`) {
        plan.confirmationState = 'approved'; return {body: structuredClone(plan)};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=apply`) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
        dispatches++; plan.status = 'accepted'; return {body: structuredClone(plan)};
      }
      if (request.url === `projects/p1/aiResourceChangePlans/${planId}`) return {body: structuredClone(plan)};
      throw Error('Unexpected service-create test path');
    },
  });
  return {engine, context, requests, audits, published, snapshot, plan: () => plan, dispatches: () => dispatches,
    async input(values = parameters) {
      if (resourceType === 'container') return {resourceType, operation: 'create', parameters: structuredClone(values)};
      const parents = await engine.execute('find_resources', {family: 'stack', query: 'same'});
      assert.notEqual(parents.items[0].resourceRef, parents.items[1].resourceRef);
      return {resourceType: 'service', operation: 'create', parentRef: parents.items[1].resourceRef, parameters: structuredClone(values)};
    }};
}

test('service create: twelve tools describe closed native fields and refuse raw launch configuration', () => {
  assert.equal(COMMANDS.length, 12);
  const tool = COMMANDS.find(item => item.name === 'preview_resource_change');
  const fields = tool.inputSchema.properties.parameters.properties;
  assert.equal(fields.ports.type, 'array'); assert.equal(fields.ports.maxItems, 64);
  assert.match(fields.ports.description, /8080:80\/tcp/); assert.match(tool.description, /Existing launch settings use upgrade, never update_metadata or a raw launchConfig/);
  assert.deepEqual(fields.healthCheck.required, ['port']); assert.equal(fields.healthCheck.additionalProperties, false);
  for (const key of ['launchConfig', 'environment', 'headers', 'recreateOnQuorumStrategyConfig']) assert.equal(Object.hasOwn(fields, key), false);
});

const containerParameters = {name: 'standalone', image: 'busybox:1.37.0', description: ' exact description ',
  command: ['sh', '-c', 'echo ready'], entryPoint: ['/bin/sh'], ports: ['80/tcp', '127.0.0.1:18080:80/udp', '[::1]:18081:81']};

test('container ports: shared browser and SDK schema keeps twelve tools and describes stopped configuration without reservation', async () => {
  const tool = COMMANDS.find(item => item.name === 'preview_resource_change');
  assert.equal(COMMANDS.length, 12); assert.match(tool.description, /Service and Container create accept ports/);
  assert.match(tool.inputSchema.properties.parameters.properties.ports.description, /does not allocate or prove a live host binding/);
  assert.match(tool.inputSchema.properties.parameters.properties.ports.description, /Preview does not reserve/);
  const f = fixture({resourceType: 'container'}), input = await f.input(containerParameters);
  const preview = await f.engine.execute('preview_resource_change', input);
  assert.equal(preview.status, 'needs_user'); assert.equal(preview.confirmationState, 'pending');
  assert.deepEqual(f.requests[0].data, input); assert.equal(f.requests.length, 1); assert.equal(f.dispatches(), 0);
  const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));
  const review = resourceReviewLabels(preview, key => key);
  assert.equal(review.createsStopped, true); assert.equal(review.displayChanges.find(item => item.field === 'ports').after, JSON.stringify(containerParameters.ports));
});

test('container ports: exact review requires human approval and verified creation does not invent assigned ports', async () => {
  const f = fixture({resourceType: 'container'}), preview = await f.engine.execute('preview_resource_change', await f.input(containerParameters));
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER'); assert.equal(f.dispatches(), 0);
  assert.equal((await f.engine.confirmPlan(preview.planRef)).confirmationState, 'approved');
  const applied = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(applied.status, 'accepted'); assert.equal(f.dispatches(), 1);
  Object.assign(f.plan(), {status: 'succeeded', verifiedResult: true});
  const result = await f.engine.execute('get_operation', {operationRef: applied.operationRef});
  assert.equal(result.status, 'succeeded'); assert.equal(result.verifiedResult, true); assert.equal(Object.hasOwn(result, 'executionResult'), false);
  assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), executionResult: {assignedPorts: ['32768:80/tcp']}}), error => error.code === 'INVALID_RESPONSE');
  assert.equal(JSON.stringify(f.audits).includes('18080'), false);
});

test('container ports: omitted changed duplicate or foreign review fields fail closed before confirmation', async () => {
  const missing = fixture({resourceType: 'container', omitReviewField: 'ports'});
  assert.equal((await missing.engine.execute('preview_resource_change', await missing.input(containerParameters))).code, 'INVALID_RESPONSE');
  assert.equal(missing.published.length, 0);
  const f = fixture({resourceType: 'container'}), preview = await f.engine.execute('preview_resource_change', await f.input(containerParameters));
  const original = structuredClone(f.plan()); f.plan().changes.find(item => item.field === 'ports').after = '["18082:80/tcp"]';
  assert.equal((await f.engine.confirmPlan(preview.planRef)).code, 'CONFLICT'); assert.equal(f.dispatches(), 0);
  for (const change of [{field: 'ports', before: null, after: '{}'}, {field: 'ports', before: null, after: '[1]'},
    {field: 'healthCheck', before: null, after: '{"port":80}'}, {field: 'ports', before: '[]', after: '[]'}]) {
    assert.throws(() => f.engine.resourcePlanSummary({...original, changes: [change]}), error => error.code === 'INVALID_RESPONSE');
  }
  assert.throws(() => f.engine.resourcePlanSummary({...original, changes: [...original.changes, original.changes.find(item => item.field === 'ports')]}), error => error.code === 'INVALID_RESPONSE');
  assert.throws(() => f.engine.resourcePlanSummary({...original, operation: 'update_metadata'}), error => error.code === 'INVALID_RESPONSE');
});

test('container ports: bounds unsupported settings and parent IDs reject without dropping ordinary create fields', async () => {
  const f = fixture({resourceType: 'container'}), input = await f.input(containerParameters);
  for (const ports of ['80', [80], [''], ['x'.repeat(129)], Array(65).fill('80'), ['80\u0000'], ['80\r'], ['80\n'], null]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {...containerParameters, ports}})).code, 'INVALID_INPUT');
  }
  for (const extra of [{healthCheck: {port: 80}}, {launchConfig: {ports: ['80']}}, {environment: {PASSWORD: privateText}}, {scale: 1}]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {...containerParameters, ...extra}})).code, 'INVALID_INPUT');
  }
  assert.equal((await f.engine.execute('preview_resource_change', {...input, parentRef: 'raw-stack-id'})).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 0); assert.equal(f.dispatches(), 0);
  for (const ports of [[], Array(64).fill('80/tcp')]) {
    const allowed = fixture({resourceType: 'container'});
    assert.equal((await allowed.engine.execute('preview_resource_change', await allowed.input({...containerParameters, ports}))).status, 'needs_user');
    assert.deepEqual(allowed.requests[0].data.parameters, {...containerParameters, ports});
  }
  const old = fixture({resourceType: 'container'});
  assert.equal((await old.engine.execute('preview_resource_change', await old.input({name: 'plain', image: 'busybox:1.37.0'}))).status, 'needs_user');
});

test('container ports: readonly native scope denial and unsupported server stay rejected without fallback or secret output', async () => {
  for (const options of [{mode: 'read-only'}, {rejectPreview: {status: 403, body: {code: 'ApiKeyScopeDenied', message: privateText}}},
    {rejectPreview: {status: 422, body: {code: 'ResourceChangeInputInvalid', message: privateText}}}]) {
    const f = fixture({...options, resourceType: 'container'});
    const result = await f.engine.execute('preview_resource_change', await f.input(containerParameters));
    assert.equal(result.status, 'rejected'); assert.equal(result.code, options.mode ? 'UNAVAILABLE' : options.rejectPreview.status === 403 ? 'FORBIDDEN' : 'INVALID_INPUT');
    if (options.rejectPreview?.status === 422) assert.match(result.nextStep, /matching typed-create adapter/);
    assert.equal(f.published.length, 0); assert.equal(f.dispatches(), 0); assert.equal(f.requests.length, options.mode ? 0 : 1);
    assert.equal(JSON.stringify([result, f.audits]).includes(privateText), false);
    assert.ok(f.requests.every(request => request.method === 'POST' && request.url === 'projects/p1/aiResourceChangePlans'));
  }
});

test('service create: selected same-name parent and exact native inputs stay in one typed preview until human approval', async () => {
  const f = fixture(), input = await f.input();
  const preview = await f.engine.execute('preview_resource_change', input);
  assert.equal(preview.status, 'needs_user'); assert.equal(preview.planKind, 'resource-change');
  assert.deepEqual(f.requests[1].data, {resourceType: 'service', operation: 'create', parameters: {...parameters, stackId: 'selected-stack'}});
  assert.equal(f.requests[1].method, 'POST'); assert.equal(f.published.length, 1); assert.equal(f.dispatches(), 0);
  assert.equal(preview.displayDiff.find(item => item.field === 'ports').after, JSON.stringify(parameters.ports));
  assert.deepEqual(JSON.parse(preview.displayDiff.find(item => item.field === 'healthCheck').after), {...healthCheck, strategy: 'recreate'});
  assert.equal(preview.displayDiff.find(item => item.field === 'startOnCreate').after, false);
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.dispatches(), 0);
  assert.equal((await f.engine.confirmPlan(preview.planRef)).confirmationState, 'approved');
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).status, 'accepted');
  assert.equal(f.dispatches(), 1);
  assert.equal(JSON.stringify([preview, f.audits]).includes('selected-stack'), false);
  assert.equal(JSON.stringify(f.audits).includes('GET /health'), false);
});

test('service create: empty ports and minimal or maximum health checks remain supported', async () => {
  for (const value of [{port: 1}, {port: 65535, strategy: 'none', requestLine: '', interval: 2147483647, responseTimeout: 1,
    healthyThreshold: 2147483647, unhealthyThreshold: 1, initializingTimeout: 0, reinitializingTimeout: 2147483647}]) {
    const f = fixture(), input = await f.input({...parameters, ports: [], healthCheck: value});
    assert.equal((await f.engine.execute('preview_resource_change', input)).status, 'needs_user');
    assert.deepEqual(f.requests[1].data.parameters.healthCheck, value);
  }
  const f = fixture(), input = await f.input({name: 'web', image: 'nginx:1.28'});
  assert.equal((await f.engine.execute('preview_resource_change', input)).status, 'needs_user');
  const automatic = fixture(), automaticInput = await automatic.input({...parameters, ports: ['80/tcp']});
  const preview = await automatic.engine.execute('preview_resource_change', automaticInput);
  assert.equal(preview.status, 'needs_user');
  assert.deepEqual(automatic.requests[1].data.parameters.ports, ['80/tcp']);
  assert.equal(preview.displayDiff.find(item => item.field === 'ports').after, '["80/tcp"]');
});

test('service create: wrong types bounds controls and unknown fields fail before dispatch', async () => {
  const f = fixture(), input = await f.input();
  const badPorts = ['8080:80', [80], [''], ['x'.repeat(129)], Array(65).fill('80/tcp'), ['80\u0000'], ['80\r'], ['80\n'], null, {}];
  for (const ports of badPorts) assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {...parameters, ports}})).code, 'INVALID_INPUT');
  const badChecks = [null, [], '80', {}, {port: '80'}, {port: 0}, {port: 65536}, {port: 80.1}, {port: 80, unknown: true},
    {port: 80, type: 'instanceHealthCheck'}, {port: 80, strategy: 'recreateOnQuorum'}, {port: 80, strategy: null},
    {port: 80, requestLine: 'x'.repeat(1025)}, {port: 80, requestLine: 'GET / HTTP/1.0\r\nAuthorization: secret'}, {port: 80, requestLine: '\u0000'}];
  for (const field of ['interval', 'responseTimeout', 'healthyThreshold', 'unhealthyThreshold', 'initializingTimeout', 'reinitializingTimeout']) {
    for (const value of [-1, 2147483648, 1.5, '2000', null]) badChecks.push({port: 80, [field]: value});
    if (!['initializingTimeout', 'reinitializingTimeout'].includes(field)) badChecks.push({port: 80, [field]: 0});
  }
  for (const check of badChecks) assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {...parameters, healthCheck: check}})).code, 'INVALID_INPUT');
  for (const extra of [{launchConfig: {ports: ['80']}}, {environment: {PASSWORD: privateText}}]) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, parameters: {...parameters, ...extra}})).code, 'INVALID_INPUT');
  }
  for (const resourceType of ['container', 'stack', 'externalService', 'dnsService']) {
    assert.equal((await f.engine.execute('preview_resource_change', {...input, resourceType})).code, 'INVALID_INPUT');
  }
  const targetRef = f.context.reference('resource', {id: 'existing', family: 'service', resourceType: 'service', scope: 'project'}, f.context.capture());
  assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_metadata', targetRef, parameters: {healthCheck}})).code, 'INVALID_INPUT');
  assert.equal((await f.engine.execute('preview_resource_change', {...input, parentRef: 'selected-stack'})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, 1); assert.equal(f.dispatches(), 0); assert.equal(f.published.length, 0);
});

test('service create: native rejection remains input error with conditional support guidance and no fallback', async () => {
  for (const code of ['ResourceChangeInputInvalid', 'ValidationError']) {
    const f = fixture({rejectPreview: {status: 422, body: {code, message: privateText, launchConfig: privateText}}}), input = await f.input({...parameters, ports: ['bad']});
    const result = await f.engine.execute('preview_resource_change', input);
    assert.equal(result.status, 'rejected'); assert.equal(result.code, 'INVALID_INPUT');
    if (code === 'ResourceChangeInputInvalid') { assert.match(result.nextStep, /native PortSpec/); assert.match(result.nextStep, /If these fields are unsupported/); }
    assert.equal(JSON.stringify([result, f.audits]).includes(privateText), false);
    assert.equal(f.requests.length, 2); assert.equal(f.published.length, 0); assert.equal(f.dispatches(), 0);
    assert.ok(f.requests.every(request => request.method === 'POST' && ['projects/p1/aiResourceViews', 'projects/p1/aiResourceChangePlans'].includes(request.url)));
  }
});

test('service create: new fields are required in the exact review and changed fields invalidate confirmation', async () => {
  for (const field of ['ports', 'healthCheck']) {
    const missing = fixture({omitReviewField: field});
    assert.equal((await missing.engine.execute('preview_resource_change', await missing.input())).code, 'INVALID_RESPONSE');
    assert.equal(missing.published.length, 0);
    const f = fixture(), preview = await f.engine.execute('preview_resource_change', await f.input());
    f.plan().changes.find(item => item.field === field).after = JSON.stringify(field === 'ports' ? ['8081:80/tcp'] : {...healthCheck, port: 81, strategy: 'recreate'});
    assert.equal((await f.engine.confirmPlan(preview.planRef)).code, 'CONFLICT');
    assert.equal(f.dispatches(), 0); assert.equal(f.published.length, 1);
  }
  const f = fixture(), preview = await f.engine.execute('preview_resource_change', await f.input());
  for (const [field, after] of [['ports', '{}'], ['ports', '[1]'], ['healthCheck', '[]'], ['healthCheck', '{"port":80,"secret":"bad"}']]) {
    assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), changes: [{field, before: null, after}]}), error => error.code === 'INVALID_RESPONSE');
  }
  assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), resourceType: 'container'}), error => error.code === 'INVALID_RESPONSE');
  assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), changes: [...f.plan().changes, f.plan().changes.find(item => item.field === 'ports')]}), error => error.code === 'INVALID_RESPONSE');
  assert.equal(preview.confirmationState, 'pending');
});

test('service create: read-only and authorization failure add no mutation route', async () => {
  const f = fixture({mode: 'read-only'}), input = await f.input();
  assert.equal((await f.engine.execute('preview_resource_change', input)).code, 'UNAVAILABLE');
  assert.equal(f.requests.length, 1); assert.equal(f.dispatches(), 0);
  const denied = fixture({rejectPreview: {status: 403, body: {code: 'KeyScopeDenied', message: privateText}}});
  assert.equal((await denied.engine.execute('preview_resource_change', await denied.input())).code, 'FORBIDDEN');
  assert.equal(denied.published.length, 0); assert.equal(denied.dispatches(), 0);
});

test('service create: native assigned ports appear only in a verified successful receipt', async () => {
  const f = fixture(), preview = await f.engine.execute('preview_resource_change', await f.input({...parameters, ports: ['80/tcp']}));
  await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  const executionResult = {assignedPorts: ['32768:80/tcp']};
  for (const state of [{status: 'preview', verifiedResult: false}, {status: 'accepted', verifiedResult: false}, {status: 'succeeded', verifiedResult: false}, {status: 'failed', verifiedResult: true}]) {
    assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), ...state, executionResult}), error => error.code === 'INVALID_RESPONSE');
  }
  Object.assign(f.plan(), {status: 'succeeded', verifiedResult: true, executionResult});
  for (const invalid of [[], {}, {assignedPorts: [1]}, {assignedPorts: '80/tcp'}, {assignedPorts: [], secret: privateText}]) {
    assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), executionResult: invalid}), error => error.code === 'INVALID_RESPONSE');
  }
  assert.throws(() => f.engine.resourcePlanSummary({...f.plan(), changes: [...f.plan().changes, {field: 'assignedPorts', before: null, after: '["32768:80/tcp"]'}]}), error => error.code === 'INVALID_RESPONSE');
  const result = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(result.status, 'succeeded'); assert.equal(result.verifiedResult, true); assert.deepEqual(result.executionResult, executionResult);
  assert.equal(f.plan().changes.find(item => item.field === 'ports').after, '["80/tcp"]');
  assert.equal(f.dispatches(), 1);
});

test('service create: friendly preview preserves ports and translates every health-check field and unit', async () => {
  const {resourceReviewLabels} = await import('data:text/javascript;base64,' + readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url)).toString('base64'));
  const f = fixture(), preview = await f.engine.execute('preview_resource_change', await f.input());
  const requestedKeys = [], t = key => { requestedKeys.push(key); return '[' + key + ']'; };
  const friendly = resourceReviewLabels(preview, t);
  assert.equal(friendly.createsStopped, true);
  assert.equal(friendly.displayChanges.find(item => item.field === 'ports').after, JSON.stringify(parameters.ports));
  const check = friendly.displayChanges.find(item => item.field === 'healthCheck');
  assert.equal(check.fieldLabel, '[newContainer.tabs.healthCheck]');
  assert.match(check.after, /\[formHealthCheck.port.label\]: 80/);
  assert.match(check.after, /\[formHealthCheck.timeout.label\]: 2000 \[formHealthCheck.timeout.unit\]/);
  assert.match(check.after, /GET \/health HTTP\/1.0/); assert.match(check.after, /\[formHealthCheck.strategy.recreate\]/);
  assert.ok(requestedKeys.includes('generic.ports')); assert.ok(requestedKeys.includes('formHealthCheck.healthyThreshold.unit'));
  assert.equal(preview.displayDiff.find(item => item.field === 'healthCheck').after, JSON.stringify({...healthCheck, strategy: 'recreate'}));
});
