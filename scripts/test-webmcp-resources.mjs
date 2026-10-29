import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS, resourceDescriptors} from '../bridge/shared-modules.mjs';
import {allowedRequest} from '../bridge/core.mjs';

const secret = 'PRIVATE_VALUE_MUST_NOT_LEAVE';
const legacy = ['find_stacks', 'find_services', 'get_service', 'update_service_description', 'preview_service_upgrade', 'apply_service_upgrade', 'get_operation'];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
function fixture({transportKind = 'browser', handle, audit} = {}) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let sequence = 0;
  const context = new CommandContext(() => snapshot, () => String(++sequence)); context.setMode('enabled');
  const requests = [], audits = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {},
    audit: async (event, captured) => { audits.push({...event, generation: captured.generation}); return audit ? audit(event, captured) : {accepted: true, requestId: `r${audits.length}`}; },
    wait: async () => {}, request: async options => { requests.push(options); return handle ? handle(options) : {body: {data: []}}; },
  });
  return {engine, context, snapshot, requests, audits};
}
const schema = descriptor => ({id: descriptor.type, collectionMethods: ['GET'], resourceMethods: ['GET'], resourceFields: {key: {default: secret}}});

test('resource families: closed twelve-tool schemas retain all seven existing commands', () => {
  assert.deepEqual(COMMANDS.map(item => item.name), ['list_capabilities', 'find_resources', 'get_resource', 'preview_resource_change', 'apply_resource_change', ...legacy]);
  for (const command of COMMANDS) {
    assert.equal(command.inputSchema.additionalProperties, false);
    assert.ok(command.inputSchema.required.length <= 2);
    for (const name of ['id', 'url', 'method', 'headers']) assert.equal(Object.hasOwn(command.inputSchema.properties, name), false);
  }
});

test('resource families: capabilities separate global and project schemas and report pending coverage honestly', async () => {
  const f = fixture({handle: async ({url}) => ({body: {data: resourceDescriptors().filter(item => item.scope === (url.startsWith('projects/') ? 'project' : 'global')).map(schema)}})});
  const result = await f.engine.execute('list_capabilities', {});
  assert.equal(result.status, 'succeeded'); assert.equal(result.families.length, 25);
  assert.deepEqual(f.requests.map(item => item.url), ['projects/p1/schemas?limit=1000', 'schemas?limit=1000']);
  assert.equal(result.families.find(item => item.family === 'service').resources[0].canFind, null);
  assert.equal(result.families.find(item => item.family === 'accounts').resources[0].scope, 'global');
  assert.equal(result.families.find(item => item.family === 'catalog').coverageStatus, 'pending-adapter');
  assert.equal(result.families.find(item => item.family === 'webhooks').coverageStatus, 'pending-adapter');
  assert.equal(result.families.find(item => item.family === 'mfa-passkey').coverageStatus, 'human-ceremony');
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(f.audits.map(item => [item.command, item.phase]), [['list_capabilities', 'start'], ['list_capabilities', 'result']]);
});

test('resource families: global permission denial never inherits project permission', async () => {
  const f = fixture({handle: async ({url}) => {
    if (url === 'schemas?limit=1000') throw {status: 403, body: {message: secret}};
    return {body: {data: [schema(resourceDescriptors().find(item => item.type === 'host'))]}};
  }});
  const result = await f.engine.execute('list_capabilities', {});
  assert.equal(result.status, 'succeeded');
  assert.equal(result.families.find(item => item.family === 'host').resources[0].canFind, true);
  const account = result.families.find(item => item.family === 'accounts').resources[0];
  assert.equal(account.canFind, null); assert.equal(account.authorization, 'requires-server-check');
});

test('resource families: stdio capability metadata needs no raw schema read grant', async () => {
  const f = fixture({transportKind: 'stdio', handle: async () => { throw Error('No business request is needed'); }});
  const result = await f.engine.execute('list_capabilities', {});
  assert.equal(result.status, 'succeeded'); assert.equal(f.requests.length, 0); assert.equal(f.audits.length, 2);
  const container = result.families.find(item => item.family === 'container').resources[0];
  assert.equal(container.authorization, 'requires-server-check'); assert.equal(container.canFind, null); assert.equal(container.canGet, null);
});

test('resource families: every implemented descriptor projects only bounded scalar metadata', async () => {
  const caps = await fixture().engine.execute('list_capabilities', {});
  for (const family of caps.families) for (const resource of family.resources) {
    const descriptor = resourceDescriptors().find(item => item.type === resource.resourceType);
    if (descriptor.readTransport === 'pending') {
      const f = fixture();
      assert.equal((await f.engine.execute('find_resources', {family: family.family, resourceType: resource.resourceType})).code, 'UNAVAILABLE');
      assert.equal(f.requests.length, 0); continue;
    }
    const body = {id: 'opaque-server-id', name: 'same-name', accountId: descriptor.scope === 'project' ? 'p1' : 'other-account', state: 'active',
      cert: secret, key: secret, secretKey: secret, publicValue: secret, privateValue: secret, activeValue: secret, value: secret,
      token: secret, password: secret, recoveryEmailMasked: secret, serverAddress: secret, description: 'Readable untrusted description', labels: {x: secret},
      environment: {x: secret}, apiKeyPolicy: {x: secret}, requestObject: secret, responseObject: secret, dockerCompose: secret,
      actionLinks: {remove: secret}, links: {self: secret}, nfsConfig: {x: secret}, driverOpts: {x: secret}};
    const f = fixture({handle: async ({url, method, data}) => ({body: method === 'POST' ? {resourceType: data.resourceType, data: [body]} : url.includes('?') ? {data: [body]} : body})});
    const found = await f.engine.execute('find_resources', {family: family.family, resourceType: resource.resourceType});
    assert.equal(found.status, 'succeeded', resource.resourceType); assert.equal(found.items.length, 1, resource.resourceType);
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
    assert.equal(detail.status, 'succeeded', resource.resourceType);
    assert.equal(detail.resourceTextIsUntrusted, true);
    assert.equal(JSON.stringify([found, detail, f.audits]).includes(secret), false, resource.resourceType);
    assert.equal(JSON.stringify([found, detail]).includes('opaque-server-id'), false);
    assert.equal(f.requests[0].url, descriptor.readTransport === 'view' ? 'projects/p1/aiResourceViews' : `${descriptor.scope === 'project' ? 'projects/p1/' : ''}${descriptor.collection}?limit=50`);
    if (descriptor.readTransport === 'view') {
      assert.deepEqual(f.requests[0].data, {resourceType: descriptor.type});
      assert.deepEqual(f.requests[1].data, {resourceType: descriptor.type, resourceId: 'opaque-server-id'});
    }
    assert.deepEqual(Object.keys(detail.fields).sort(), ['description', 'name', 'state']);
  }
});

test('resource families: full 1024-unit descriptions are retained and truncation is explicit', async () => {
  const body = {id: 'v1', name: 'x'.repeat(600), description: '🌿'.repeat(512)};
  const f = fixture({handle: async ({url}) => ({body: url.includes('?') ? {data: [body]} : body})});
  const found = await f.engine.execute('find_resources', {family: 'storage'});
  assert.equal(found.items[0].fields.description, body.description);
  assert.deepEqual(found.items[0].truncatedFields, ['name']);
  const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(detail.fields.description, body.description); assert.deepEqual(detail.truncatedFields, ['name']);
  body.description += 'x';
  const truncated = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(truncated.fields.description.length, 1024); assert.deepEqual(truncated.truncatedFields, ['name', 'description']);
});

const planId = 'aichange-11111111-1111-1111-1111-111111111111';
function lifecycleFixture(options = {}) {
  const plans = []; let plan, applies = 0;
  const f = fixture({...options, handle: async request => {
    if (request.url === 'projects/p1/aiResourceViews') return {body: {resourceType: request.data.resourceType, data: [{id: 'target', accountId: 'p1', name: 'target'}]}};
    if (request.url === 'projects/p1/aiResourceChangePlans') {
      const data = request.data;
      plan = {id: planId, resourceType: data.resourceType, operation: data.operation, resourceId: data.resourceId || null,
        targetPath: 'Environment/Stack/target', changes: [{field: 'state', before: 'inactive', after: 'active'}],
        confirmationState: 'pending', status: 'preview', expiresAt: '2026-10-29T13:00:00Z', verifiedResult: false};
      if(data.operation==='remove')plan.changes.push({field:'affectedInstanceCount',before:0,after:0},{field:'affectedMountCount',before:0,after:null},
        {field:'mountedDataRule',before:null,after:'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'});
      return {body: {...plan}};
    }
    if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=confirm`) { plan.confirmationState = 'approved'; return {body: {...plan}}; }
    if (request.url === `projects/p1/aiResourceChangePlans/${planId}?action=apply`) {
      if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'ResourceChangeNeedsConfirmation'}};
      applies++; plan.status = 'accepted';
      if (options.apply) return options.apply(request, plan);
      return {body: {...plan}};
    }
    if (request.url === `projects/p1/aiResourceChangePlans/${planId}`) return {body: {...plan}};
    if (request.method === 'GET') return {body: {data: [{id: 'target', accountId: 'p1', name: 'target'}]}};
    throw Error('Unexpected lifecycle fixture request');
  }});
  f.engine.onPlan = value => plans.push(value);
  return {...f, plans, applies: () => applies, plan: () => plan,
    async target(type = 'service') { return (await f.engine.execute('find_resources', {family: type})).items[0].resourceRef; },
  };
}

test('resource lifecycle: fixed operation descriptors create exact bounded payloads with opaque targets', async () => {
  const operations = {stack: ['start', 'stop', 'remove', 'create', 'update_metadata'],
    service: ['start', 'stop', 'restart', 'remove', 'scale', 'create', 'update_metadata'],
    container: ['start', 'stop', 'restart', 'remove', 'create', 'update_metadata']};
  for (const [resourceType, names] of Object.entries(operations)) for (const operation of names) {
    const f = lifecycleFixture(), input = {resourceType, operation};
    if (operation === 'create') {
      input.parameters = resourceType === 'stack' ? {name: 'new'} : {name: 'new', image: 'busybox:1.37.0'};
      if (resourceType === 'service') input.parentRef = await f.target('stack');
    } else {
      input.targetRef = await f.target(resourceType);
      if (operation === 'scale') input.parameters = {scale: 0};
      if (operation === 'update_metadata') input.parameters = {description: null};
    }
    const result = await f.engine.execute('preview_resource_change', input);
    assert.equal(result.status, 'needs_user', `${resourceType}/${operation}`);
    assert.equal(result.planKind, 'resource-change');
    const payload = f.requests.find(item => item.url === 'projects/p1/aiResourceChangePlans').data;
    assert.deepEqual(Object.keys(payload).sort(), operation === 'create' ? ['operation', 'parameters', 'resourceType'] : ['operation', 'parameters', 'resourceId', 'resourceType']);
    if (resourceType === 'service' && operation === 'create') assert.deepEqual(payload.parameters, {name: 'new', image: 'busybox:1.37.0', stackId: 'target'});
    assert.equal(f.applies(), 0); assert.equal(f.plans.length, 1);
    assert.equal(JSON.stringify(f.audits).includes('busybox'), false);
  }
});

test('resource lifecycle: parameter validation rejects raw IDs secrets unsupported fields and bad values', async () => {
  const f = lifecycleFixture(), targetRef = await f.target();
  const inputs = [
    {resourceType: 'stack', operation: 'restart', targetRef},
    {resourceType: 'service', operation: 'scale', targetRef, parameters: {scale: 101}},
    {resourceType: 'service', operation: 'scale', targetRef, parameters: {scale: 1.1}},
    {resourceType: 'service', operation: 'scale', targetRef, parameters: {scale: '2'}},
    {resourceType: 'service', operation: 'start', targetRef, parameters: {image: 'hidden'}},
    {resourceType: 'service', operation: 'update_metadata', targetRef, parameters: {}},
    {resourceType: 'service', operation: 'update_metadata', targetRef, parameters: {description: 'x'.repeat(1025)}},
    {resourceType: 'service', operation: 'update_metadata', targetRef, parameters: {description: {secret}}},
    {resourceType: 'container', operation: 'create', parameters: {name: 'x', image: 'image', environment: {secret}}},
    {resourceType: 'service', operation: 'create', parameters: {name: 'x', image: 'image', stackId: 'target'}},
    {resourceType: 'service', operation: 'create', parameters: {name: 'x', image: 'image'}},
    {resourceType: 'container', operation: 'create', targetRef, parameters: {name: 'x', image: 'image'}},
    {resourceType: 'service', operation: 'start', resourceId: 'target'},
  ];
  for (const input of inputs) assert.equal((await f.engine.execute('preview_resource_change', input)).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 1);
  const missingImage = await f.engine.execute('preview_resource_change', {resourceType: 'container', operation: 'create', parameters: {name: 'new'}});
  assert.equal(missingImage.field, 'parameters.image'); assert.match(missingImage.nextStep, /Ask the user/);
  const missingName = await f.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'create'});
  assert.equal(missingName.field, 'parameters.name');
  for (const description of ['', null, ' 維護🌿\n'.repeat(3)]) {
    const result = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'update_metadata', targetRef, parameters: {description}});
    assert.equal(result.status, 'needs_user'); assert.equal(f.requests.at(-1).data.parameters.description, description);
  }
});

test('resource lifecycle: create command arrays are bounded and human changes retain exact JSON', async () => {
  const f = lifecycleFixture();
  const base = {resourceType: 'container', operation: 'create', parameters: {name: 'new', image: 'busybox:1.37.0'}};
  for (const value of ['shell', [1], ['\u0000'], Array(65).fill('x'), ['x'.repeat(4097)], Array(5).fill('x'.repeat(4096))]) {
    for (const field of ['command', 'entryPoint']) {
      const result = await f.engine.execute('preview_resource_change', {...base, parameters: {...base.parameters, [field]: value}});
      assert.equal(result.code, 'INVALID_INPUT', field);
    }
  }
  assert.equal(f.requests.length, 0);
  const args = {command: ['sh', '-c', 'sleep 600; echo "<script>"'], entryPoint: []};
  assert.equal((await f.engine.execute('preview_resource_change', {...base, parameters: {...base.parameters, ...args}})).status, 'needs_user');
  assert.deepEqual(f.requests.at(-1).data.parameters, {...base.parameters, ...args});
  const plan = {...f.plan(), changes: [{field: 'command', before: null, after: JSON.stringify(args.command)}, {field: 'entryPoint', before: null, after: '[]'}]};
  assert.equal(f.engine.resourcePlanSummary(plan, 'ref').displayDiff[0].after, JSON.stringify(args.command));
  assert.throws(() => f.engine.resourcePlanSummary({...plan, changes: [{field: 'credential', before: null, after: secret}]}, 'ref'));
  for (const value of ['not-json', '{}', '[1]', '["\\u0000"]', JSON.stringify(Array(65).fill('x'))]) {
    assert.throws(() => f.engine.resourcePlanSummary({...plan, changes: [{field: 'command', before: null, after: value}]}, 'ref'));
  }
});

test('resource lifecycle: exact child state and remove safety summary remains bounded and typed', async () => {
  const f = lifecycleFixture(), targetRef = await f.target('stack');
  await f.engine.execute('preview_resource_change', {resourceType:'stack',operation:'remove',targetRef});
  const plan={...f.plan(),changes:[{field:'state',before:'active',after:'removed'},{field:'affectedServiceCount',before:3,after:0},
    {field:'affectedInstanceCount',before:6,after:0},{field:'affectedMountCount',before:4,after:null},
    {field:'mountedDataRule',before:null,after:'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'}]};
  assert.equal(f.engine.resourcePlanSummary(plan,'ref').displayDiff.length,5);
  assert.throws(()=>f.engine.resourcePlanSummary({...plan,changes:plan.changes.filter(change=>change.field!=='mountedDataRule')},'ref'));
  for(const change of [{field:'affectedMountCount',before:-1,after:null},{field:'affectedInstanceCount',before:'6',after:0},
    {field:'affectedMountCount',before:4,after:0},
    {field:'mountedDataRule',before:null,after:'ALL_DATA_ALWAYS_RETAINED'},{field:'startOnCreate',before:null,after:true}]) {
    assert.throws(()=>f.engine.resourcePlanSummary({...plan,changes:[change]},'ref'));
  }
});

test('resource lifecycle: legacy opaque stack and service refs work without accepting raw IDs', async () => {
  const f = lifecycleFixture(), captured = f.context.capture();
  const stackRef = f.context.reference('stack', {id: 'legacy-stack'}, captured);
  const serviceRef = f.context.reference('service', {id: 'legacy-service'}, captured);
  assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'create', parentRef: stackRef, parameters: {name: 'new', image: 'exact:1'}})).status, 'needs_user');
  assert.equal(f.requests.at(-1).data.parameters.stackId, 'legacy-stack');
  assert.equal((await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'stop', targetRef: serviceRef})).status, 'needs_user');
  const stale = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'stop', targetRef: 'legacy-service'});
  assert.equal(stale.code, 'STALE_REFERENCE'); assert.match(stale.nextStep, /find_resources/);
});

test('resource lifecycle: human approval gates apply and operation reads only the same durable resource plan', async () => {
  const f = lifecycleFixture(), targetRef = await f.target();
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'start', targetRef});
  assert.equal((await f.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'NEEDS_USER');
  assert.equal(f.applies(), 0);
  assert.equal((await f.engine.confirmPlan(preview.planRef)).confirmationState, 'approved');
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(accepted.status, 'accepted'); assert.ok(accepted.operationRef);
  f.plan().status = 'dispatching';
  assert.equal((await f.engine.execute('get_operation', {operationRef: accepted.operationRef})).status, 'running');
  assert.equal(f.requests.filter(item => item.method === 'GET' && item.url.endsWith(planId)).length, 10);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  const completed = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(completed.status, 'succeeded'); assert.equal(completed.verifiedResult, true); assert.equal(f.applies(), 1);
  assert.equal((await f.engine.execute('apply_service_upgrade', {planRef: preview.planRef})).code, 'INVALID_INPUT');
});

test('resource lifecycle: lost apply response retains recovery ref and never sends a second mutation', async () => {
  const f = lifecycleFixture({apply: async () => { throw TypeError('connection lost'); }}), targetRef = await f.target();
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'restart', targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const uncertain = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(uncertain.status, 'unknown'); assert.ok(uncertain.operationRef); assert.equal(f.applies(), 1);
  f.plan().status = 'succeeded'; f.plan().verifiedResult = true;
  assert.equal((await f.engine.execute('get_operation', {operationRef: uncertain.operationRef})).status, 'succeeded');
  assert.equal(f.applies(), 1);
});

test('resource lifecycle: submitted write stays unknown after actor change without returning old refs', async () => {
  const entered = deferred(), barrier = deferred();
  const f = lifecycleFixture({apply: async (_request, plan) => { entered.resolve(); await barrier.promise; return {body: {...plan}}; }}), targetRef = await f.target();
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'remove', targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const pending = f.engine.execute('apply_resource_change', {planRef: preview.planRef}); await entered.promise;
  f.snapshot.generation = 'g2'; barrier.resolve();
  const result = await pending;
  assert.equal(result.status, 'unknown'); assert.equal(Object.hasOwn(result, 'operationRef'), false); assert.equal(f.applies(), 1);
  assert.ok(f.audits.every(item => item.generation === 'g1'));
});

test('resource lifecycle: result audit failure preserves operation recovery and bounded API errors remain actionable', async () => {
  const f = lifecycleFixture({audit: async event => {
    if (event.command === 'apply_resource_change' && event.phase === 'result') throw Error(secret);
    return {accepted: true, requestId: 'ack'};
  }}), targetRef = await f.target();
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'start', targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const unknown = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  assert.equal(unknown.status, 'unknown'); assert.ok(unknown.operationRef); assert.equal(f.applies(), 1);
  for (const [status, serverCode, code] of [[422, 'ResourceChangeUnsupported', 'UNAVAILABLE'], [409, 'ResourceChangePlanStale', 'CONFLICT'],
    [403, 'ResourceChangeNeedsConfirmation', 'FORBIDDEN'], [422, 'ResourceViewNarrowQuery', 'INVALID_INPUT'],
    [403, 'ResourceViewNarrowQuery', 'FORBIDDEN'], [503, 'ResourceChangeFeatureDisabled', 'UNAVAILABLE'], [503, 'ResourceChangeAuditUnavailable', 'UNKNOWN_RESULT']]) {
    const g = fixture({handle: async () => { throw {status, body: {code: serverCode, message: secret}}; }});
    const result = await g.engine.execute('find_resources', {family: 'certificates'});
    assert.equal(result.code, code); assert.equal(JSON.stringify(result).includes(secret), false);
    if (serverCode === 'ResourceViewNarrowQuery' && code === 'INVALID_INPUT') { assert.equal(result.field, 'query'); assert.match(result.nextStep, /narrower query/); }
    if (serverCode === 'ResourceViewNarrowQuery' && code === 'FORBIDDEN') assert.equal(Object.hasOwn(result, 'field'), false);
  }
  assert.equal(allowedRequest(`projects/p1/aiResourceChangePlans/${planId}?action=confirm`, 'POST', 'p1'), false);
  assert.equal(allowedRequest(`projects/p1/aiResourceChangePlans/${planId}?action=apply`, 'POST', 'p1'), true);
});

test('resource authorization failure: authorized terminal receipt stays failed and retains its original operation', async () => {
  const f = lifecycleFixture(), targetRef = await f.target(), observed = [];
  f.engine.onOperation = operation => observed.push(operation);
  const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'stop', targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
  Object.assign(f.plan(), {status: 'failed', verifiedResult: false, operationId: planId,
    messageCode: 'ResourceChangeAuthorizationDenied', processId: secret, exception: secret, payload: secret});
  const result = await f.engine.execute('get_operation', {operationRef: accepted.operationRef});
  assert.equal(result.status, 'failed'); assert.equal(result.code, 'FORBIDDEN');
  assert.equal(result.operationRef, accepted.operationRef); assert.equal(result.verifiedResult, false);
  assert.equal(result.partialEffectsPossible, true); assert.equal(result.messageCode, 'ResourceChangeAuthorizationDenied');
  assert.match(result.nextStep, /background authorization/); assert.match(result.nextStep, /Some changes may already/);
  assert.match(result.nextStep, /same operationRef/); assert.match(result.nextStep, /Do not blindly resubmit/);
  assert.equal(f.applies(), 1); assert.equal(f.requests.filter(request => request.method === 'GET').length, 1);
  assert.deepEqual(observed.at(-1), {planId, status: 'failed', messageCode: 'ResourceChangeAuthorizationDenied'});
  assert.equal(f.audits.at(-1).reason, 'FORBIDDEN'); assert.equal(f.audits.at(-1).status, 'failed');
  assert.equal(JSON.stringify([result, observed, f.audits]).includes(secret), false);
});

test('resource authorization failure: only the exact failed resource receipt receives the partial-change repair', () => {
  const f = fixture();
  for (const plan of [
    {id: planId, status: 'accepted', messageCode: 'ResourceChangeAuthorizationDenied'},
    {id: planId, status: 'running', messageCode: 'ResourceChangeAuthorizationDenied'},
    {id: planId, status: 'failed', messageCode: 'OtherFailure'},
    {id: planId, status: 'failed', messageCode: 'ResourceChangeAuthorizationDenied-extra'},
    {id: 'aiplan-11111111-1111-1111-1111-111111111111', status: 'failed', messageCode: 'ResourceChangeAuthorizationDenied'},
  ]) {
    const result = f.engine.operationSummary(plan, 'existing-operation');
    assert.equal(Object.hasOwn(result, 'partialEffectsPossible'), false);
    assert.equal(Object.hasOwn(result, 'code'), false);
  }
  const failed = f.engine.operationSummary({id: planId, status: 'failed', verifiedResult: true,
    messageCode: 'ResourceChangeAuthorizationDenied'}, 'existing-operation');
  assert.equal(failed.status, 'failed'); assert.equal(failed.verifiedResult, false);
});

test('resource authorization failure: forbidden reads and late context changes do not publish a terminal receipt', async () => {
  for (const mode of ['forbidden', 'context-changed']) {
    const f = lifecycleFixture(), targetRef = await f.target(), observed = [];
    const preview = await f.engine.execute('preview_resource_change', {resourceType: 'service', operation: 'stop', targetRef});
    await f.engine.confirmPlan(preview.planRef);
    const accepted = await f.engine.execute('apply_resource_change', {planRef: preview.planRef});
    f.engine.onOperation = operation => observed.push(operation);
    const entered = deferred(), barrier = deferred();
    f.engine.request = async () => {
      if (mode === 'forbidden') throw {status: 403, body: {code: 'KeyScopeDenied', message: secret}};
      entered.resolve(); await barrier.promise;
      return {body: {...f.plan(), status: 'failed', messageCode: 'ResourceChangeAuthorizationDenied'}};
    };
    const pending = f.engine.execute('get_operation', {operationRef: accepted.operationRef});
    if (mode === 'context-changed') { await entered.promise; f.snapshot.generation = 'other-session'; barrier.resolve(); }
    const result = await pending;
    assert.equal(result.status, 'rejected'); assert.equal(result.code, mode === 'forbidden' ? 'FORBIDDEN' : 'CONTEXT_CHANGED');
    assert.equal(Object.hasOwn(result, 'partialEffectsPossible'), false); assert.deepEqual(observed, []);
    assert.equal(f.applies(), 1); assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test('resource lifecycle: plan capacity rejection never recommends another preview', async () => {
  const f = lifecycleFixture(), targetRef = await f.target();
  f.engine.request = async () => { throw {status:409,body:{code:'ResourceChangeQuotaExceeded',message:secret}}; };
  const result=await f.engine.execute('preview_resource_change',{resourceType:'service',operation:'stop',targetRef});
  assert.equal(result.status,'rejected');assert.equal(result.code,'CAPACITY');
  assert.match(result.nextStep,/Cancel unused pending plans/);assert.match(result.nextStep,/Do not create more/);
  assert.equal(f.audits.at(-1).reason,'CAPACITY');assert.equal(f.audits.at(-1).status,'rejected');
  assert.equal(JSON.stringify(result).includes(secret),false);
});

test('resource lifecycle: target busy waits on an existing active ref without parallel resubmission', async () => {
  const f=lifecycleFixture(),targetRef=await f.target();
  const preview=await f.engine.execute('preview_resource_change',{resourceType:'service',operation:'start',targetRef});
  await f.engine.confirmPlan(preview.planRef);
  const accepted=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});
  f.engine.request=async()=>{throw {status:409,body:{code:'ResourceChangeTargetBusy'}};};
  const busy=await f.engine.execute('preview_resource_change',{resourceType:'service',operation:'restart',targetRef});
  assert.equal(busy.status,'rejected');assert.equal(busy.code,'CONFLICT');assert.equal(busy.reason,'TARGET_BUSY');
  assert.equal(busy.operationRef,accepted.operationRef);assert.match(busy.nextStep,/wait for completion/);assert.match(busy.nextStep,/Do not submit parallel/);
  assert.equal(f.applies(),1);
  f.context.resolve(accepted.operationRef,'operation',f.context.capture()).lastStatus='succeeded';
  const finished=await f.engine.execute('preview_resource_change',{resourceType:'service',operation:'restart',targetRef});
  assert.equal(Object.hasOwn(finished,'operationRef'),false);assert.match(finished.nextStep,/Wait for the current operation/);
});

test('resource families: reject IDs URLs methods cross-family types and pending adapters before reads', async () => {
  const f = fixture();
  for (const input of [{family: 'service', id: 's1'}, {family: 'service', url: '/secrets'}, {family: 'service', method: 'DELETE'},
    {family: 'service', resourceType: 'account'}, {family: 'unknown'}, {family: 'service', query: 1}]) {
    assert.equal((await f.engine.execute('find_resources', input)).code, 'INVALID_INPUT');
  }
  assert.equal((await f.engine.execute('get_resource', {resourceRef: 's1'})).code, 'STALE_REFERENCE');
  assert.equal((await f.engine.execute('find_resources', {family: 'webhooks'})).code, 'UNAVAILABLE');
  assert.equal(f.requests.length, 0);
  assert.equal(f.audits.length, 16);
});

test('resource families: duplicate candidates remain distinct and project results cannot cross scope', async () => {
  const f = fixture({handle: async () => ({body: {resourceType: 'service', data: [{id: 's1', name: 'web', accountId: 'p1', stackId: 'st1', stackName: 'Alpha'},
    {id: 's2', name: 'web', accountId: 'p1', stackId: 'st2', parentResolution: 'unavailable'}, {id: 's3', name: 'web', accountId: 'p2'}]}})});
  const found = await f.engine.execute('find_resources', {family: 'service', query: 'web'});
  assert.equal(found.items.length, 2); assert.notEqual(found.items[0].resourceRef, found.items[1].resourceRef);
  assert.equal(found.items[0].displayPath, 'Environment/Alpha/web');
  assert.equal(found.items[1].parentResolution, 'unavailable'); assert.match(found.nextStep, /parentRef/);
  assert.notEqual(found.items[0].parentRef, found.items[1].parentRef);
  assert.equal(Object.hasOwn(found, 'selected'), false);
  f.snapshot.projectId = f.snapshot.schemaProjectId = 'p2';
  assert.equal((await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, 1);
});

test('resource families: cursors bind family type query parent and scoped next-page path', async () => {
  const f = fixture({handle: async ({url}) => ({body: url.includes('/stacks?') ? {data: [{id: 'st1', name: 'Parent'}]} : {
    resourceType: 'service', data: [{id: 's1', name: 'web', stackId: 'st1'}], nextMarker: 'next',
  }})});
  const parentRef = (await f.engine.execute('find_resources', {family: 'stack'})).items[0].resourceRef;
  const input = {family: 'service', query: 'web', parentRef};
  const found = await f.engine.execute('find_resources', input);
  assert.ok(found.nextCursor); assert.equal(found.complete, false);
  for (const delta of [{family: 'container'}, {query: 'other'}, {parentRef: undefined}, {resourceType: 'host'}]) {
    const changed = {...input, cursor: found.nextCursor, ...delta};
    if (changed.parentRef === undefined) delete changed.parentRef;
    assert.equal((await f.engine.execute('find_resources', changed)).code, 'INVALID_INPUT');
  }
  assert.equal(f.requests.length, 2);
  assert.equal((await f.engine.execute('find_resources', {...input, cursor: found.nextCursor})).status, 'succeeded');
  assert.equal(f.requests[2].url, 'projects/p1/aiResourceViews');
  assert.deepEqual(f.requests[2].data, {resourceType: 'service', query: 'web', marker: 'next', parentId: 'st1'});
  assert.equal(found.items[0].parentRef, parentRef);
  for (const next of ['https://other.test/v2-beta/projects/p1/containers', '/v2-beta/projects/p2/containers', '/v2-beta/projects/p1/secrets',
    '/v2-beta/projects/p1/containers?accountId=p2', '/v2-beta/projects/p1/containers?limit=1000', '/v2-beta/projects/p1/containers?stackId=other']) {
    const g = fixture({handle: async () => ({body: {data: [], pagination: {next}}})});
    assert.equal((await g.engine.execute('find_resources', {family: 'container'})).code, 'INVALID_RESPONSE', next);
  }
});

test('resource families: late context changes reject old response and never audit with the new session', async () => {
  const waiting = deferred(), entered = deferred();
  const f = fixture({handle: async () => { entered.resolve(); return waiting.promise; }});
  const pending = f.engine.execute('find_resources', {family: 'host'}); await entered.promise;
  f.snapshot.generation = 'g2'; waiting.resolve({body: {data: [{id: 'h1', name: 'host'}]}});
  const result = await pending;
  assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(Object.hasOwn(result, 'items'), false);
  assert.equal(f.audits.length, 1); assert.equal(f.audits[0].generation, 'g1');
});

test('resource families: confirmed API denials are bounded and audit start failure gates all reads', async () => {
  for (const [status, code] of [[401, 'SESSION_REQUIRED'], [403, 'FORBIDDEN'], [409, 'CONFLICT']]) {
    const f = fixture({handle: async () => { throw {status, body: {code: secret, message: secret}}; }});
    const result = await f.engine.execute('find_resources', {family: 'host'});
    assert.equal(result.code, code); assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(f.audits.length, 2);
  }
  const f = fixture({audit: async () => { throw Error(secret); }});
  assert.equal((await f.engine.execute('find_resources', {family: 'host'})).code, 'UNAVAILABLE');
  assert.equal(f.requests.length, 0);
});

test('resource families: stdio uses safe views and excludes sensitive domain payloads and arbitrary requests', async () => {
  const f = fixture({transportKind: 'stdio', handle: async ({data}) => ({body: {resourceType: data.resourceType, data: []}})});
  for (const family of ['api-keys', 'accounts', 'audit', 'settings', 'secrets', 'certificates', 'registry', 'processes',
    'container', 'host', 'storage', 'network', 'stack', 'service', 'environment', 'virtualmachine']) {
    const result = await f.engine.execute('find_resources', {family});
    assert.equal(result.status, 'succeeded', family);
  }
  assert.equal(f.requests.length, 16);
  assert.ok(f.requests.every(item => item.method === 'POST' && item.url === 'projects/p1/aiResourceViews'));
  for (const descriptor of resourceDescriptors()) {
    const url = `${descriptor.scope === 'project' ? 'projects/p1/' : ''}${descriptor.collection}`;
    assert.equal(allowedRequest(url + '?limit=50', 'GET', 'p1'), descriptor.bridgeRead, descriptor.type);
    assert.equal(allowedRequest(url + '/id', 'PUT', 'p1'), false);
    if (descriptor.scope === 'project') assert.equal(allowedRequest(url.replace('p1/', 'p2/'), 'GET', 'p1'), false);
  }
  assert.equal(allowedRequest('projects/p1/aiResourceViews', 'POST', 'p1'), true);
  assert.equal(allowedRequest('projects/p2/aiResourceViews', 'POST', 'p1'), false);
  assert.equal(allowedRequest('projects/p1/aiResourceViews?resourceId=x', 'POST', 'p1'), false);
  for (const url of ['schemas?limit=1000', 'projects/p1/schemas?limit=1000']) assert.equal(allowedRequest(url, 'GET', 'p1'), false);
  for (const url of ['token', 'auth/config', 'projects/p1/containers/id?action=execute', 'projects/p1/secrets/id',
    'projects/p1/containers/id/secret', 'projects/p1/containers?accountId=p2', 'https://other.test/schemas', '/schemas', '../schemas']) {
    assert.equal(allowedRequest(url, 'GET', 'p1'), false, url);
  }
});

test('resource families: safe-view markers stay opaque and malformed detail cannot become success', async () => {
  const f = fixture({handle: async ({data}) => ({body: {resourceType: 'certificate', data: [{id: 'c1', name: 'cert'}], nextMarker: data.marker ? null : 'server-marker'}})});
  const first = await f.engine.execute('find_resources', {family: 'certificates', query: 'cert'});
  assert.equal(first.complete, false); assert.equal(JSON.stringify(first).includes('server-marker'), false);
  const next = await f.engine.execute('find_resources', {family: 'certificates', query: 'cert', cursor: first.nextCursor});
  assert.equal(next.complete, true);
  assert.deepEqual(f.requests[1].data, {resourceType: 'certificate', query: 'cert', marker: 'server-marker'});
  for (const body of [{resourceType: 'account', data: []}, {resourceType: 'certificate', data: [{id: 'other'}]},
    {resourceType: 'certificate', data: [{id: 'c1'}, {id: 'c1'}]}, {resourceType: 'certificate', data: [], nextMarker: {url: secret}}]) {
    f.engine.request = async () => ({body});
    assert.equal((await f.engine.execute('get_resource', {resourceRef: first.items[0].resourceRef})).code, 'INVALID_RESPONSE');
  }
});
