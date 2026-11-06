import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS, resourceDescriptors} from '../bridge/shared-modules.mjs';
import {allowedRequest} from '../bridge/core.mjs';
import {resourceReviewLabels} from '../app/utils/ai-resource-review-labels.js';

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

function tcpBalancerFixture({changePreview, applyError} = {}) {
  let plan, applies = 0;
  const f = fixture({handle: async ({url, method, data}) => {
    if(url === 'projects/p1/stacks?limit=50') return {body:{data:[{id:'native-stack',type:'stack',accountId:'p1',name:'Blue'}]}};
    if(url === 'projects/p1/aiResourceViews') return {body:{resourceType:data.resourceType,data:[
      {id:'native-backend-one',type:'service',accountId:'p1',name:'db',stackId:'native-stack',stackName:'Blue',parentResolution:'resolved'},
      {id:'native-backend-two',type:'service',accountId:'p1',name:'db',stackId:'native-other-stack',stackName:'Green',parentResolution:'resolved'}]}};
    if(url === 'projects/p1/aiResourceChangePlans' && method === 'POST') {
      plan={id:'aichange-00000000-0000-4000-8000-000000000077',resourceType:'loadBalancerService',operation:'create',
        targetPath:'Environment / Blue / edge',status:'preview',verifiedResult:false,confirmationState:'pending',expiresAt:'2026-11-06T12:00:00Z',
        changes:[{field:'name',before:null,after:data.parameters.name},
          {field:'portRules',before:null,after:JSON.stringify(data.parameters.portRules.map(rule=>({protocol:rule.protocol,access:rule.access,
            sourcePort:rule.sourcePort,targetPort:rule.targetPort,target:rule.serviceId==='native-backend-one'?'Blue / db':'Green / db'})))},
          {field:'startOnCreate',before:null,after:data.parameters.startOnCreate},{field:'scale',before:null,after:1},
          {field:'image',before:null,after:'docker:registry.test/lb:1'}]};
      if(changePreview) changePreview(plan);return {body:plan};
    }
    if(url.includes('aiResourceChangePlans/') && method === 'GET') return {body:plan};
    if(url.endsWith('?action=confirm')) {plan.confirmationState='approved';return {body:plan};}
    if(url.endsWith('?action=apply')) {
      applies++;if(applyError) throw applyError;
      plan={...plan,operationId:plan.id,status:'accepted',verifiedResult:false};return {body:plan};
    }
    throw Error('unexpected TCP fixture transport');
  }});
  return {...f,plan:()=>plan,applies:()=>applies,refs:async()=>{
    const stacks=await f.engine.execute('find_resources',{family:'stack',resourceType:'stack'});
    const services=await f.engine.execute('find_resources',{family:'service',resourceType:'service'});
    assert.equal(stacks.status,'succeeded');assert.equal(services.status,'succeeded');
    return {parentRef:stacks.items[0].resourceRef,serviceRefs:services.items.map(row=>row.resourceRef)};
  }};
}
const tcpBalancerInput=(refs,startOnCreate=true)=>({resourceType:'loadBalancerService',operation:'create',parentRef:refs.parentRef,
  parameters:{name:'edge',startOnCreate,portRules:refs.serviceRefs.map((serviceRef,index)=>({protocol:'tcp',access:index?'internal':'public',
    sourcePort:index?9000:8080,targetPort:index?81:80,serviceRef}))}});

test('TCP LB create: capabilities disclose the closed rule schema and a complete opaque-reference example without a new tool', async () => {
  const f=fixture({transportKind:'stdio'}),result=await f.engine.execute('list_capabilities',{});
  const resource=result.families.find(row=>row.family==='load-balancer').resources.find(row=>row.resourceType==='loadBalancerService');
  assert.ok(resource.operations.includes('create'));assert.equal(COMMANDS.length,12);
  const workflow=resource.createWorkflow;assert.equal(workflow.availability,'requires-fresh-server-check');
  assert.deepEqual(workflow.portRules.items.required,['protocol','access','sourcePort','targetPort','serviceRef']);
  assert.equal(workflow.portRules.items.additionalProperties,false);assert.deepEqual(workflow.portRules.items.properties.protocol.enum,['tcp']);
  assert.deepEqual(workflow.portRules.items.properties.access.enum,['public','internal']);
  assert.equal(typeof workflow.example.parameters.startOnCreate,'boolean');assert.equal(workflow.example.parameters.portRules[0].targetPort,80);
  assert.match(workflow.parent,/find_resources/);assert.match(workflow.target,/same-name/);assert.match(workflow.example.parentRef,/returned/);
});

test('TCP LB create: explicit startup and every listener/backend reach fresh human review without raw IDs', async () => {
  for(const start of [false,true]) {
    const f=tcpBalancerFixture(),refs=await f.refs(),input=tcpBalancerInput(refs,start),before=JSON.stringify(input);
    const preview=await f.engine.execute('preview_resource_change',input);
    assert.equal(preview.status,'needs_user');assert.equal(f.applies(),0);assert.equal(JSON.stringify(input),before);
    const submitted=f.requests.at(-1).data.parameters;assert.equal(submitted.stackId,'native-stack');
    assert.deepEqual(submitted.portRules.map(row=>row.serviceId),['native-backend-one','native-backend-two']);
    assert.ok(submitted.portRules.every(row=>!Object.hasOwn(row,'serviceRef')));
    const rows=JSON.parse(preview.displayDiff.find(row=>row.field==='portRules').after);
    assert.deepEqual(rows.map(row=>row.target),['Blue / db','Green / db']);assert.equal(rows[1].targetPort,81);
    assert.equal(preview.displayDiff.find(row=>row.field==='startOnCreate').after,start);
    assert.equal(JSON.stringify([preview,f.audits]).includes('native-backend'),false);
    assert.equal(COMMANDS.length,12);await f.engine.confirmPlan(preview.planRef);
    const applied=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});
    assert.equal(applied.status,'accepted');assert.equal(applied.verifiedResult,false);assert.ok(applied.operationRef);
    const reads=f.requests.filter(row=>row.method==='GET'&&row.url.includes('aiResourceChangePlans/'));
    assert.ok(reads.length>=1,'the exact immutable review is re-read before apply');
    f.plan().status='succeeded';f.plan().verifiedResult=true;
    const done=await f.engine.execute('get_operation',{operationRef:applied.operationRef});
    assert.equal(done.status,'succeeded');assert.equal(done.verifiedResult,true);assert.equal(f.applies(),1);
  }
});

test('TCP LB create: unsupported protocol/raw configuration/missing choices/stale references reject before preview HTTP', async () => {
  const f=tcpBalancerFixture(),refs=await f.refs(),base=tcpBalancerInput(refs),before=f.requests.length;
  const bad=[{...base,parameters:{...base.parameters,startOnCreate:undefined}},
    {...base,parameters:{...base.parameters,lbConfig:{portRules:[]}}},
    {...base,parameters:{...base.parameters,portRules:[{...base.parameters.portRules[0],serviceId:'1s9'}]}},
    {...base,parameters:{...base.parameters,portRules:[{...base.parameters.portRules[0],protocol:'https'}]}},
    {...base,parameters:{...base.parameters,portRules:[{...base.parameters.portRules[0],weight:10}]}},
    {...base,parameters:{...base.parameters,portRules:[{...base.parameters.portRules[0],sourcePort:42}]}},
    {...base,parameters:{...base.parameters,portRules:[{...base.parameters.portRules[0],serviceRef:'raw-id'}]}},
    {...base,parameters:{...base.parameters,portRules:[]}},
    {...base,parameters:{...base.parameters,portRules:[base.parameters.portRules[0],{...base.parameters.portRules[1],sourcePort:8080}]}}];
  for(const input of bad) {
    const result=await f.engine.execute('preview_resource_change',input);assert.ok(['INVALID_INPUT','STALE_REFERENCE'].includes(result.code));
    assert.match(result.nextStep,/do not drop or downgrade/);assert.match(result.nextStep,/serviceRef/);
  }
  assert.equal(f.requests.length,before);f.snapshot.generation='g2';
  assert.equal((await f.engine.execute('preview_resource_change',base)).code,'STALE_REFERENCE');assert.equal(f.requests.length,before);
});

test('TCP LB create: server omissions/reordering/startup changes and post-approval checkpoint tampering never apply', async () => {
  for(const mutate of [plan=>plan.changes=plan.changes.filter(row=>row.field!=='portRules'),
    plan=>plan.changes.find(row=>row.field==='startOnCreate').after=false,
    plan=>{const row=plan.changes.find(row=>row.field==='portRules');row.after=JSON.stringify(JSON.parse(row.after).reverse());},
    plan=>{const row=plan.changes.find(row=>row.field==='portRules');row.after=JSON.stringify([{protocol:'tcp',access:'public',sourcePort:8080,targetPort:80,target:'Blue / db',serviceId:'PRIVATE'}]);}]) {
    const f=tcpBalancerFixture({changePreview:mutate}),refs=await f.refs();
    assert.equal((await f.engine.execute('preview_resource_change',tcpBalancerInput(refs))).code,'INVALID_RESPONSE');assert.equal(f.applies(),0);
  }
  const f=tcpBalancerFixture(),refs=await f.refs(),preview=await f.engine.execute('preview_resource_change',tcpBalancerInput(refs));
  await f.engine.confirmPlan(preview.planRef);f.plan().changes.find(row=>row.field==='image').after='docker:other:1';
  assert.equal((await f.engine.execute('apply_resource_change',{planRef:preview.planRef})).code,'CONFLICT');assert.equal(f.applies(),0);
});

test('TCP LB create: forbidden or uncertain apply keeps the original operation and never falls back or reconstructs a create', async () => {
  for(const status of [403,500]) {
    const f=tcpBalancerFixture({applyError:{status,body:{code:status===403?'ApiKeyRevoked':'InternalError',message:secret}}}),refs=await f.refs();
    const preview=await f.engine.execute('preview_resource_change',tcpBalancerInput(refs));await f.engine.confirmPlan(preview.planRef);
    const result=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});assert.equal(f.applies(),1);
    assert.equal(result.status,status===403?'rejected':'unknown');if(status===500)assert.ok(result.operationRef);
    assert.equal(JSON.stringify([result,f.audits]).includes(secret),false);
    assert.equal(f.requests.filter(row=>row.url==='projects/p1/aiResourceChangePlans').length,1);
  }
});

test('TCP LB create: existing human labels show both named Stack targets and exact ports without mutating reviewed JSON', () => {
  const rows=[{protocol:'tcp',access:'public',sourcePort:8080,targetPort:80,target:'Blue / db'},
    {protocol:'tcp',access:'internal',sourcePort:9000,targetPort:81,target:'Green / db'}];
  const plan={resourceType:'loadBalancerService',operation:'create',displayDiff:[{field:'portRules',before:null,after:JSON.stringify(rows)},
    {field:'startOnCreate',before:null,after:true}]},before=JSON.stringify(plan),keys=[];
  const review=resourceReviewLabels(plan,key=>{keys.push(key);return key;});
  assert.equal(review.createsStopped,false);assert.equal(review.displayChanges[0].fieldLabel,'formBalancerRules.label');
  assert.match(review.displayChanges[0].after,/Blue \/ db/);assert.match(review.displayChanges[0].after,/Green \/ db/);
  assert.match(review.displayChanges[0].after,/8080/);assert.match(review.displayChanges[0].after,/81/);
  assert.ok(keys.includes('formBalancerRules.access.internal'));assert.equal(JSON.stringify(plan),before);
});

const policyReadOperations = ['read','create','update','upgrade','delete','exec','logs','export'];
function policyReadCeiling(observed = false) {
  return {basis:'native-owner-ceiling',effectiveAuthorization:'not-evaluated',reason:'OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION',
    operations:policyReadOperations.map(operation=>({operation,status:observed&&operation==='read'?'observed':'unknown'}))};
}
function policyReadSource(rules = [], revision = 0) {
  return {availability:'available',representation:'configured-policy-read-only',revision,
    configuredPolicy:{mode:rules.length?'custom':'full',defaultEffect:rules.length?'deny':'allow',purpose:'general',expiresAt:null,rules},
    defaultOwnerCapabilities:policyReadCeiling(),allConfiguredRulesIncluded:true,
    scopePreviewComplete:rules.every(rule=>rule.scope.availability==='resolved'),previewComplete:false,effectiveAuthorization:'not-evaluated',
    reason:rules.every(rule=>rule.scope.availability==='resolved')?'OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION':'SCOPE_PREVIEW_INCOMPLETE'};
}
function policyReadRule(ordinal, id, accountId = 'p1') {
  return {ordinal,effect:ordinal%2?'deny':'allow',operations:['read','update'],
    scope:{kind:'resource',resourceType:'service',availability:'resolved',reason:'NONE',target:{id,type:'service',name:'same-name',accountId}},
    ownerCapabilities:policyReadCeiling(true)};
}
function policyReadFixture(kind, read, extra = {}) {
  const key = {id:'native-key-id',type:kind,accountId:'a1',name:'same-name',kind,state:'active',apiKeyPolicyRead:read,
    secretValue:secret,publicValue:secret,data:{TOKEN:secret}};
  return fixture({transportKind:extra.transportKind,handle:async options=>{
    assert.equal(options.method,'POST');assert.equal(options.url,'projects/p1/aiResourceViews');
    if(extra.handle) return extra.handle(options,key);
    return {body:{resourceType:options.data.resourceType,data:[key],nextMarker:null}};
  }});
}

test('API Key configured policy: detail retains full legacy revision zero and all 128 configured rules without raw identifiers or list expansion', async () => {
  for(const kind of ['apiKey','apiKeyRestricted']) {
    const read=kind==='apiKey'?policyReadSource():policyReadSource(Array.from({length:128},(_,index)=>policyReadRule(index+1,'native-scope-service')),7);
    const f=policyReadFixture(kind,read);f.context.setMode('read-only');
    const found=await f.engine.execute('find_resources',{family:'api-keys',resourceType:kind});
    assert.equal(found.status,'succeeded');assert.equal(JSON.stringify(found).includes('configuredPolicy'),false);
    const detail=await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef});
    assert.equal(detail.status,'succeeded');assert.ok(detail.policyRead,'configured policy detail must be projected');assert.equal(detail.policyRead.representation,'configured-policy-read-only');
    assert.equal(detail.policyRead.revision,kind==='apiKey'?0:7);assert.equal(detail.policyRead.previewComplete,false);
    assert.equal(detail.policyRead.effectiveAuthorization,'not-evaluated');
    const rules=detail.policyRead.configuredPolicy.rules;assert.equal(rules.length,kind==='apiKey'?0:128);
    if(rules.length) {
      assert.equal(rules.filter(rule=>rule.effect==='deny').length,64);assert.equal(detail.policyRead.configuredPolicy.defaultEffect,'deny');
      assert.equal(new Set(rules.map(rule=>rule.scope.target.resourceRef)).size,1);
      assert.equal(rules[0].ownerCapabilities.operations.find(item=>item.operation==='read').status,'observed');
    }
    assert.equal(JSON.stringify([found,detail]).includes('native-key-id'),false);
    assert.equal(JSON.stringify([found,detail]).includes('native-scope-service'),false);
    assert.equal(JSON.stringify([found,detail,f.audits]).includes(secret),false);
    assert.equal(f.requests.length,2,'scope projection must not create browser HTTP requests per rule');
    assert.deepEqual(f.audits.map(event=>[event.command,event.phase]),[['find_resources','start'],['find_resources','result'],['get_resource','start'],['get_resource','result']]);
  }
});

test('API Key configured policy: same-name targets keep distinct opaque refs and missing or foreign-context scopes stay explicitly incomplete', async () => {
  const rules=[policyReadRule(1,'native-service-one'),policyReadRule(2,'native-service-two'),policyReadRule(3,'native-service-foreign','p2')];
  rules.push({ordinal:4,effect:'deny',operations:['delete'],scope:{kind:'stack',resourceType:'stack',availability:'unavailable',reason:'SCOPE_TARGET_UNAVAILABLE'},ownerCapabilities:policyReadCeiling()});
  const f=policyReadFixture('apiKeyRestricted',policyReadSource(rules,3));
  const found=await f.engine.execute('find_resources',{family:'api-keys',resourceType:'apiKeyRestricted'});
  const detail=await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef});assert.equal(detail.status,'succeeded');assert.ok(detail.policyRead,'configured policy detail must be projected');
  const actual=detail.policyRead.configuredPolicy.rules;assert.notEqual(actual[0].scope.target.resourceRef,actual[1].scope.target.resourceRef);
  assert.equal(actual[0].scope.target.name,actual[1].scope.target.name);assert.equal(actual[2].scope.availability,'unavailable');
  assert.equal(actual[2].scope.reason,'SCOPE_CONTEXT_UNAVAILABLE');assert.equal(actual[3].scope.reason,'SCOPE_TARGET_UNAVAILABLE');
  assert.equal(actual[2].scope.target,undefined);assert.equal(actual[3].scope.target,undefined);assert.equal(detail.policyRead.scopePreviewComplete,false);
  assert.equal(detail.policyRead.reason,'SCOPE_PREVIEW_INCOMPLETE');assert.ok(detail.policyRead.message.length>10);
  assert.ok(actual[2].ownerCapabilities.operations.every(item=>item.status==='unknown'));
  const output=JSON.stringify(detail);for(const raw of ['native-service-one','native-service-two','native-service-foreign','p2','resourceId']) assert.equal(output.includes(raw),false,raw);
});

test('API Key configured policy: malformed matrices revoked reads and stale refs fail closed while the twelve-tool input contract stays unchanged', async () => {
  assert.equal(COMMANDS.length,12);const command=COMMANDS.find(item=>item.name==='get_resource');
  assert.deepEqual(Object.keys(command.inputSchema.properties),['resourceRef','view']);
  assert.deepEqual(command.inputSchema.properties.view.enum,['stack_graph']);
  assert.deepEqual(command.inputSchema.required,['resourceRef']);
  for(const mutate of [read=>read.configuredPolicy.rules.push({...policyReadRule(1,'native-scope-service'),effect:'permit'}),
    read=>read.defaultOwnerCapabilities.basis='effective-key-grant',read=>read.url='http://foreign/',
    read=>read.configuredPolicy.expiresAt='yesterday',
    read=>{read.configuredPolicy.rules.push({ordinal:1,effect:'deny',operations:['read'],scope:{kind:'stack',resourceType:'stack',availability:'unavailable',reason:'SCOPE_TARGET_UNAVAILABLE'},ownerCapabilities:{url:'http://foreign/'}});read.scopePreviewComplete=false;}]) {
    const read=policyReadSource();mutate(read);const f=policyReadFixture('apiKey',read);
    const found=await f.engine.execute('find_resources',{family:'api-keys',resourceType:'apiKey'});
    const detail=await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef});assert.equal(detail.code,'INVALID_RESPONSE');
    assert.equal(JSON.stringify(detail).includes(secret),false);
  }
  let revoked=false;
  const f=policyReadFixture('apiKey',policyReadSource(),{handle:async(options,key)=>{
    if(revoked&&options.data.resourceId) throw {status:403,body:{code:'ApiKeyRevoked',message:secret}};
    return {body:{resourceType:'apiKey',data:[key],nextMarker:null}};
  }});
  const found=await f.engine.execute('find_resources',{family:'api-keys',resourceType:'apiKey'});revoked=true;
  assert.equal((await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef})).code,'FORBIDDEN');
  const before=f.requests.length;f.snapshot.generation='g2';
  assert.equal((await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef})).code,'STALE_REFERENCE');
  assert.equal(f.requests.length,before);assert.equal(JSON.stringify(f.audits).includes(secret),false);
});

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
    const templateId = 'ctm-' + 'a'.repeat(64), versionId = 'cvm-' + 'b'.repeat(64);
    const templateFields = {name: body.name, description: body.description, catalogId: 'library', templateBase: 'infra', templateKey: 'database',
      catalogScope: 'global', defaultVersion: '1.0', maintainer: 'Community', license: 'Apache-2.0'};
    const versionFields = {version: '1.0', revision: 3, minimumRancherVersion: '1.6.0', maximumRancherVersion: '2.0.0', upgradeFrom: '^0.9'};
    const template = {...body, ...templateFields, id: templateId, type: 'catalogTemplate'};
    const version = {...body, ...versionFields, id: versionId, type: 'catalogTemplateVersion', templateId};
    const f = fixture({handle: async ({url, method, data}) => {
      if (descriptor.readTransport === 'catalog') {
        assert.equal(method, 'POST');
        if (url === 'projects/p1/aiCatalogStackLaunchOptions') {
          assert.deepEqual(data, {templateId, versionId});
          return {body: {optionsRef: 'acopts-11111111-1111-1111-1111-111111111111', launchEnabled: false,
            requiredOperations: ['read', 'create', 'update'], questions: []}};
        }
        assert.equal(url, 'projects/p1/aiCatalogMetadataViews');
        if (data.versions) {
          assert.equal(data.templateId, templateId);
          if (data.versionId) assert.equal(data.versionId, versionId);
          return {body: {resourceType: 'catalogTemplateVersion', data: [version], nextMarker: null}};
        }
        if (data.templateId) assert.equal(data.templateId, templateId);
        return {body: {resourceType: 'catalogTemplate', data: [template], nextMarker: null}};
      }
      return {body: method === 'POST' ? {resourceType: data.resourceType, data: [body]} : url.includes('?') ? {data: [body]} : body};
    }});
    const input = {family: family.family, resourceType: resource.resourceType};
    if (descriptor.type === 'catalogTemplateVersion') {
      const parents = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplate'});
      assert.equal(parents.status, 'succeeded'); input.parentRef = parents.items[0].resourceRef;
    }
    const found = await f.engine.execute('find_resources', input);
    assert.equal(found.status, 'succeeded', resource.resourceType); assert.equal(found.items.length, 1, resource.resourceType);
    const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
    assert.equal(detail.status, 'succeeded', resource.resourceType);
    assert.equal(detail.resourceTextIsUntrusted, true);
    assert.equal(JSON.stringify([found, detail, f.audits]).includes(secret), false, resource.resourceType);
    assert.equal(JSON.stringify([found, detail]).includes('opaque-server-id'), false);
    if (descriptor.readTransport === 'catalog') {
      const expected = descriptor.type === 'catalogTemplateVersion' ? [
        ['aiCatalogMetadataViews', {}], ['aiCatalogMetadataViews', {templateId, versions: true}],
        ['aiCatalogMetadataViews', {templateId, versions: true, versionId}], ['aiCatalogStackLaunchOptions', {templateId, versionId}],
      ] : [['aiCatalogMetadataViews', {}], ['aiCatalogMetadataViews', {templateId}]];
      assert.deepEqual(f.requests.map(request => [request.url, request.method, request.data]),
        expected.map(([collection, data]) => [`projects/p1/${collection}`, 'POST', data]));
      for (const id of [templateId, versionId]) assert.equal(JSON.stringify([found, detail]).includes(id), false);
      if (descriptor.type === 'catalogTemplateVersion') {
        assert.equal(detail.parentRef, input.parentRef); assert.equal(detail.launchOptions.launchEnabled, false);
        assert.deepEqual(detail.launchOptions.requiredOperations, ['read', 'create', 'update']);
      }
    } else assert.equal(f.requests[0].url, descriptor.readTransport === 'view' ? 'projects/p1/aiResourceViews' : `${descriptor.scope === 'project' ? 'projects/p1/' : ''}${descriptor.collection}?limit=50`);
    if (descriptor.readTransport === 'view') {
      assert.deepEqual(f.requests[0].data, {resourceType: descriptor.type});
      assert.deepEqual(f.requests[1].data, {resourceType: descriptor.type, resourceId: 'opaque-server-id'});
    }
    const expectedFields = descriptor.type === 'processInstance' ? {} : descriptor.readTransport === 'catalog' ? descriptor.type === 'catalogTemplateVersion' ? versionFields : templateFields :
      {description: body.description, name: body.name, state: body.state};
    assert.deepEqual(found.items[0].fields, expectedFields); assert.deepEqual(detail.fields, expectedFields);
  }
});

test('resource families: full 1024-unit descriptions are retained and truncation is explicit', async () => {
  const body = {id: 'v1', name: 'x'.repeat(600), description: '🌿'.repeat(512)};
  const f = fixture({handle: async ({url, method, data}) => {
    if (url === 'projects/p1/aiResourceViews') {
      assert.equal(method, 'POST'); assert.deepEqual(data, {resourceType: 'volume', resourceId: 'v1'});
      return {body: {resourceType: 'volume', data: [body]}};
    }
    return {body: url.includes('?') ? {data: [body]} : body};
  }});
  const found = await f.engine.execute('find_resources', {family: 'storage'});
  assert.equal(found.items[0].fields.description, body.description);
  assert.deepEqual(found.items[0].truncatedFields, ['name']);
  const detail = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(detail.fields.description, body.description); assert.deepEqual(detail.truncatedFields, ['name']);
  body.description += 'x';
  const truncated = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(truncated.fields.description.length, 1024); assert.deepEqual([...truncated.truncatedFields].sort(), ['description', 'name']);
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


test('Next candidate combined wiring: one engine reads Key configured policy and previews TCP create plus shared LB start and stop',async()=>{
  let plan,index=200;
  const f=fixture({handle:async({url,method,data})=>{
    if(method==='GET'&&['schemas?limit=1000','projects/p1/schemas?limit=1000'].includes(url)) return {body:{data:[]}};
    if(url==='projects/p1/stacks?limit=50') return {body:{data:[{id:'native-next-stack',type:'stack',accountId:'p1',name:'Blue'}]}};
    if(url==='projects/p1/aiResourceViews') {
      const common={accountId:'p1',name:'shared',stackId:'native-next-stack',stackName:'Blue',parentResolution:'resolved'};
      const row=data.resourceType==='apiKey'?{id:'native-next-key',type:'apiKey',accountId:'a1',name:'Key',kind:'apiKey',state:'active',apiKeyPolicyRead:policyReadSource()}:
        data.resourceType==='service'?{...common,id:'native-next-backend',type:'service'}:{...common,id:'native-next-lb',type:'loadBalancerService',state:'inactive'};
      return {body:{resourceType:data.resourceType,data:[row]}};
    }
    assert.equal(url,'projects/p1/aiResourceChangePlans');assert.equal(method,'POST');
    const create=data.operation==='create';
    if(create) {
      assert.equal(data.parameters.stackId,'native-next-stack');assert.equal(data.parameters.startOnCreate,false);
      assert.deepEqual(data.parameters.portRules,[{protocol:'tcp',access:'public',sourcePort:8080,targetPort:80,serviceId:'native-next-backend'}]);
    } else {assert.equal(data.resourceId,'native-next-lb');assert.deepEqual(data.parameters,{});}
    plan={id:`aichange-00000000-0000-4000-8000-000000000${index++}`,resourceType:'loadBalancerService',operation:data.operation,
      ...(create?{}:{resourceId:data.resourceId}),targetPath:'Environment / Blue / shared',status:'preview',verifiedResult:false,
      confirmationState:'pending',expiresAt:'2026-11-06T12:00:00Z',changes:create?[{field:'name',before:null,after:'edge'},
        {field:'portRules',before:null,after:JSON.stringify([{protocol:'tcp',access:'public',sourcePort:8080,targetPort:80,target:'Blue / shared'}])},
        {field:'startOnCreate',before:null,after:false},{field:'scale',before:null,after:1},{field:'image',before:null,after:'docker:registry.test/lb:1'}]:
        [{field:'state',before:data.operation==='start'?'inactive':'active',after:data.operation==='start'?'active':'inactive'}]};return {body:plan};
  }});
  const caps=await f.engine.execute('list_capabilities',{}),lb=caps.families.find(row=>row.family==='load-balancer').resources[0];
  for(const operation of ['create','start','stop','scale']) assert.ok(lb.operations.includes(operation));
  for(const operation of ['remove','upgrade','restart']) assert.equal(lb.operations.includes(operation),false);
  assert.deepEqual(lb.createWorkflow.portRules.items.required,['protocol','access','sourcePort','targetPort','serviceRef']);
  const keys=await f.engine.execute('find_resources',{family:'api-keys',resourceType:'apiKey'});
  const detail=await f.engine.execute('get_resource',{resourceRef:keys.items[0].resourceRef});
  assert.equal(detail.policyRead.representation,'configured-policy-read-only');assert.equal(detail.policyRead.effectiveAuthorization,'not-evaluated');
  const stacks=await f.engine.execute('find_resources',{family:'stack',resourceType:'stack'});
  const services=await f.engine.execute('find_resources',{family:'service',resourceType:'service'});
  const create=await f.engine.execute('preview_resource_change',tcpBalancerInput({parentRef:stacks.items[0].resourceRef,serviceRefs:[services.items[0].resourceRef]},false));
  assert.equal(create.status,'needs_user');assert.equal(JSON.parse(create.displayDiff.find(row=>row.field==='portRules').after)[0].target,'Blue / shared');
  const rows=await f.engine.execute('find_resources',{family:'load-balancer',resourceType:'loadBalancerService'});
  for(const operation of ['start','stop']) {
    const preview=await f.engine.execute('preview_resource_change',{resourceType:'loadBalancerService',operation,targetRef:rows.items[0].resourceRef,parameters:{}});
    assert.equal(preview.status,'needs_user');assert.deepEqual(preview.displayDiff,[{field:'state',before:operation==='start'?'inactive':'active',after:operation==='start'?'active':'inactive'}]);
    assert.equal(preview.displayPath,'Environment / Blue / shared');assert.equal(JSON.stringify(preview).includes('native-next-'),false);
  }
  assert.equal(COMMANDS.length,12);assert.equal(f.requests.filter(row=>row.url.endsWith('?action=apply')).length,0);
  assert.equal(f.requests.filter(row=>row.url==='projects/p1/aiResourceChangePlans').length,3);
});

function lbLifecycleFixture({denyApply=false}={}) {
  let plan,applies=0;
  const f=fixture({handle:async({url,method,data})=>{
    if(method==='GET'&&['schemas?limit=1000','projects/p1/schemas?limit=1000'].includes(url)) return {body:{data:[]}};
    if(url==='projects/p1/aiResourceViews') return {body:{resourceType:'loadBalancerService',data:[
      {id:'native-lb-blue',type:'loadBalancerService',accountId:'p1',name:'edge',state:'inactive',stackId:'native-stack-blue',stackName:'Blue',parentResolution:'resolved'},
      {id:'native-lb-green',type:'loadBalancerService',accountId:'p1',name:'edge',state:'active',stackId:'native-stack-green',stackName:'Green',parentResolution:'resolved'}]}};
    if(url==='projects/p1/aiResourceChangePlans'&&method==='POST') {
      assert.deepEqual(data.parameters,{});assert.ok(['start','stop'].includes(data.operation));
      const blue=data.resourceId==='native-lb-blue';
      plan={id:'aichange-00000000-0000-4000-8000-000000000088',resourceType:'loadBalancerService',operation:data.operation,resourceId:data.resourceId,
        targetPath:`Environment / ${blue?'Blue':'Green'} / edge`,status:'preview',verifiedResult:false,confirmationState:'pending',expiresAt:'2026-11-06T12:00:00Z',
        changes:[{field:'state',before:data.operation==='start'?'inactive':'active',after:data.operation==='start'?'active':'inactive'}]};return {body:plan};
    }
    if(url.includes('aiResourceChangePlans/')&&method==='GET') return {body:plan};
    if(url.endsWith('?action=confirm')) {plan.confirmationState='approved';return {body:plan};}
    if(url.endsWith('?action=apply')) {
      applies++;if(denyApply) throw {status:403,body:{code:'ApiKeyRevoked',message:secret}};
      plan={...plan,operationId:plan.id,status:'accepted',verifiedResult:false};return {body:plan};
    }
    throw Error('unexpected LB lifecycle transport');
  }});return {...f,plan:()=>plan,applies:()=>applies};
}

test('LB shared Service lifecycle: capabilities and same-name opaque targets require human approval then one native start or stop receipt',async()=>{
  for(const operation of ['start','stop']) {
    const f=lbLifecycleFixture(),caps=await f.engine.execute('list_capabilities',{});
    const resource=caps.families.find(row=>row.family==='load-balancer').resources[0];
    assert.ok(resource.operations.includes('start'));assert.ok(resource.operations.includes('stop'));assert.ok(resource.operations.includes('scale'));
    for(const unsupported of ['restart','remove','upgrade']) assert.equal(resource.operations.includes(unsupported),false);
    assert.equal(COMMANDS.length,12);
    const found=await f.engine.execute('find_resources',{family:'load-balancer',resourceType:'loadBalancerService',query:'edge'});
    assert.equal(found.items.length,2);const chosen=found.items[operation==='start'?0:1];
    assert.equal(chosen.fields.name,'edge');assert.match(chosen.displayPath,operation==='start'?/Blue/:/Green/);
    const preview=await f.engine.execute('preview_resource_change',{resourceType:'loadBalancerService',operation,targetRef:chosen.resourceRef,parameters:{}});
    assert.equal(preview.status,'needs_user');assert.equal(f.applies(),0);assert.match(preview.displayPath,operation==='start'?/Blue/:/Green/);
    assert.deepEqual(preview.displayDiff,[{field:'state',before:operation==='start'?'inactive':'active',after:operation==='start'?'active':'inactive'}]);
    assert.equal(JSON.stringify(preview).includes('native-lb-'),false);await f.engine.confirmPlan(preview.planRef);
    const applied=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});
    assert.equal(applied.status,'accepted');assert.equal(applied.verifiedResult,false);assert.equal(f.applies(),1);
    f.plan().status='running';let observed=await f.engine.execute('get_operation',{operationRef:applied.operationRef});
    assert.equal(observed.status,'running');assert.equal(observed.verifiedResult,false);
    f.plan().status='succeeded';f.plan().verifiedResult=true;observed=await f.engine.execute('get_operation',{operationRef:applied.operationRef});
    assert.equal(observed.verifiedResult,true);assert.equal(f.applies(),1);
  }
});

test('LB shared Service lifecycle: injected config raw IDs stale contexts and revoked applies never broaden or replay the action',async()=>{
  const f=lbLifecycleFixture(),found=await f.engine.execute('find_resources',{family:'load-balancer',resourceType:'loadBalancerService'});
  const input={resourceType:'loadBalancerService',operation:'start',targetRef:found.items[0].resourceRef,parameters:{}};
  const before=f.requests.length;
  for(const field of ['lbConfig','portRules','launchConfig','ports','certificateIds','volumes','scale','action'])
    assert.equal((await f.engine.execute('preview_resource_change',{...input,parameters:{[field]:'UNAPPROVED'}})).code,'INVALID_INPUT');
  assert.equal((await f.engine.execute('preview_resource_change',{...input,targetRef:'native-lb-blue'})).code,'STALE_REFERENCE');
  f.snapshot.projectId='foreign';f.snapshot.schemaProjectId='foreign';assert.equal((await f.engine.execute('preview_resource_change',input)).code,'STALE_REFERENCE');
  assert.equal(f.requests.length,before);
  const denied=lbLifecycleFixture({denyApply:true}),rows=await denied.engine.execute('find_resources',{family:'load-balancer',resourceType:'loadBalancerService'});
  const preview=await denied.engine.execute('preview_resource_change',{resourceType:'loadBalancerService',operation:'start',targetRef:rows.items[0].resourceRef,parameters:{}});
  await denied.engine.confirmPlan(preview.planRef);const result=await denied.engine.execute('apply_resource_change',{planRef:preview.planRef});
  assert.equal(result.status,'rejected');assert.equal(result.code,'FORBIDDEN');assert.equal(denied.applies(),1);
  assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(denied.requests.filter(row=>row.url.endsWith('?action=apply')).length,1);
});

function stackGraphFixture(transportKind = 'stdio') {
  const root = {id: 'native-stack', type: 'stack', accountId: 'p1', name: 'Blue', state: 'inactive', dockerCompose: secret};
  const graph = {subset: 'ordinary-service-links', completeness: 'unknown', permissionCompleteness: 'unknown', nodeLimit: 32, edgeLimit: 32,
    limitReached: false, nodes: ['1s9', '1s10'].map(id => ({id, type: 'service', accountId: 'p1', name: 'same-name', nameTruncated: false, state: 'inactive'})),
    edges: [{sourceId: '1s9', targetId: '1s10', relationship: 'service-link'}]};
  const faults = {};
  const f = fixture({transportKind, handle: async ({url, data}) => {
    if (url === 'projects/p1/stacks?limit=50') return {body: {data: [root]}};
    if (url === 'projects/p1/stacks?limit=1000') return {body: {data: [root]}};
    if (url === 'projects/p1/services?limit=50') return {body: {data: [
      {id: '1s9', type: 'service', accountId: 'p1', stackId: root.id, name: 'same-name', state: 'inactive'},
    ]}};
    if (url === 'projects/p1/stacks/native-stack') return {body: root};
    if (url === 'projects/p1/aiResourceViews') {
      if (data.view) {
        if (faults.error) throw faults.error;
        return {body: {resourceType: 'stack', data: [{...root, stackGraph: faults.graph || graph}]}};
      }
      return {body: {resourceType: data.resourceType, data: data.resourceType === 'stack' ? [root] :
        [{id: data.resourceId || '1s9', type: 'service', accountId: 'p1', name: 'same-name', state: 'inactive'}]}};
    }
    if (url.startsWith('projects/p1/services/')) return {body: {id: url.split('/').at(-1), type: 'service', accountId: 'p1', name: 'same-name', state: 'inactive'}};
    throw Error('Unexpected fixed graph fixture route');
  }});
  return {...f, graph, faults};
}

test('Resource reference guidance: tool descriptions distinguish legacy refs from generic Stack graph refs without schema rejection', () => {
  assert.equal(COMMANDS.length, 12);
  const detail = COMMANDS.find(row => row.name === 'get_resource');
  const stacks = COMMANDS.find(row => row.name === 'find_stacks');
  const services = COMMANDS.find(row => row.name === 'find_services');
  for (const description of [detail.description, detail.inputSchema.properties.resourceRef.description]) {
    assert.match(description, /find_resources/);
    assert.match(description, /stackRef/);
    assert.match(description, /serviceRef/);
  }
  assert.match(stacks.description, /legacy/i);
  assert.match(stacks.description, /find_resources/);
  assert.match(stacks.description, /stack_graph/);
  assert.match(services.description, /resourceRef/);
  assert.match(detail.inputSchema.properties.view.description, /find_resources/);
  assert.equal(Object.hasOwn(detail.inputSchema.properties.resourceRef, 'pattern'), false,
    'wrong namespaces must reach the shared audited command handler');
});

test('Resource reference guidance: legacy Stack and Service refs reject with audited correction and recover through generic reads only', async () => {
  for (const transport of ['browser', 'stdio']) {
    const f = stackGraphFixture(transport);
    const stacks = await f.engine.execute('find_stacks', {query: 'Blue'});
    const services = await f.engine.execute('find_services', {query: 'same-name'});
    assert.equal(stacks.status, 'succeeded'); assert.equal(services.status, 'succeeded');
    for (const reference of [stacks.items[0].stackRef, services.items[0].serviceRef]) {
      for (const view of [undefined, 'stack_graph']) {
        const requests = f.requests.length, audits = f.audits.length;
        const result = await f.engine.execute('get_resource', {resourceRef: reference, ...(view ? {view} : {})});
        assert.equal(result.code, 'INVALID_INPUT'); assert.equal(result.field, 'resourceRef');
        assert.equal(result.status, 'rejected'); assert.match(result.nextStep, /find_resources/);
        for (const word of ['stack', 'service', 'resourceRef', 'stackRef', 'serviceRef', 'stack_graph']) assert.ok(result.nextStep.includes(word));
        assert.match(result.nextStep, /unchanged/); assert.match(result.nextStep, /never|do not/i);
        assert.equal(JSON.stringify(result).includes(reference), false);
        assert.equal(f.requests.length, requests, 'invalid namespaces cause no native resource request');
        assert.deepEqual(f.audits.slice(audits).map(row => [row.command, row.phase, row.reason]),
          [['get_resource', 'start', 'NONE'], ['get_resource', 'result', 'INVALID_INPUT']]);
      }
    }
    const stack = await f.engine.execute('find_resources', {family: 'stack', query: 'Blue'});
    const graph = await f.engine.execute('get_resource', {resourceRef: stack.items[0].resourceRef, view: 'stack_graph'});
    assert.equal(graph.status, 'succeeded'); assert.equal(graph.graph.nodes.length, 2);
    const service = await f.engine.execute('find_resources', {family: 'service', query: 'same-name'});
    const detail = await f.engine.execute('get_resource', {resourceRef: service.items[0].resourceRef});
    assert.equal(detail.status, 'succeeded'); assert.equal(detail.fields.name, 'same-name');
    assert.ok(f.requests.every(row => row.method === 'GET' || row.method === 'POST' && row.url === 'projects/p1/aiResourceViews'));
    assert.ok(f.requests.every(row => !/[?&]action=/.test(row.url) && !row.url.includes('ChangePlan')));
    assert.equal(JSON.stringify(f.audits).includes('native-stack'), false);
  }
});

test('Resource reference guidance: genuine expired and unknown generic refs retain stale-reference behavior and both audit events', async () => {
  for (const transport of ['browser', 'stdio']) {
    const f = stackGraphFixture(transport);
    const found = await f.engine.execute('find_resources', {family: 'stack'});
    const expired = found.items[0].resourceRef;
    f.context.invalidate();
    for (const reference of [expired, 'resource_unknown-nonce', 'resource_stack_unknown-nonce', 'resource_service_unknown-nonce']) {
      const requests = f.requests.length, audits = f.audits.length;
      const result = await f.engine.execute('get_resource', {resourceRef: reference, view: 'stack_graph'});
      assert.equal(result.code, 'STALE_REFERENCE'); assert.equal(result.field, 'resourceRef');
      assert.equal(result.nextStep, 'Search again and reuse the new reference unchanged.');
      assert.equal(f.requests.length, requests);
      assert.deepEqual(f.audits.slice(audits).map(row => [row.command, row.phase, row.reason]),
        [['get_resource', 'start', 'NONE'], ['get_resource', 'result', 'STALE_REFERENCE']]);
    }
  }
});

test('Stack graph: opt-in ordinary Service links preserve 12 tools, opaque same-name refs and ordinary detail cost', async () => {
  assert.equal(COMMANDS.length, 12);
  for (const transport of ['browser', 'stdio']) {
    const f = stackGraphFixture(transport), found = await f.engine.execute('find_resources', {family: 'stack'}), resourceRef = found.items[0].resourceRef;
    const ordinary = await f.engine.execute('get_resource', {resourceRef}); assert.equal(ordinary.status, 'succeeded'); assert.equal(ordinary.graph, undefined);
    assert.equal(f.requests.some(request => request.data?.view), false);
    const result = await f.engine.execute('get_resource', {resourceRef, view: 'stack_graph'});
    assert.equal(result.status, 'succeeded'); assert.equal(result.graph.nodes.length, 2); assert.equal(result.graph.edges.length, 1);
    assert.equal(result.graph.completeness, 'unknown'); assert.equal(result.graph.permissionCompleteness, 'unknown');
    const [first, second] = result.graph.nodes; assert.equal(first.name, second.name); assert.notEqual(first.resourceRef, second.resourceRef);
    assert.equal(result.graph.edges[0].sourceRef, first.resourceRef); assert.equal(result.graph.edges[0].targetRef, second.resourceRef);
    assert.equal((await f.engine.execute('get_resource', {resourceRef: second.resourceRef})).fields.name, 'same-name');
    const serialized = JSON.stringify(result);
    for (const forbidden of ['1s9', '1s10', 'native-stack', secret, 'dockerCompose']) assert.equal(serialized.includes(forbidden), false);
    assert.ok(f.requests.every(request => !/[?&]action=/.test(request.url) && !request.url.includes('ChangePlan')));
    assert.equal(f.requests.filter(request => request.data?.view === 'stack_graph').length, 1);
    const before = f.requests.length;
    assert.equal((await f.engine.execute('get_resource', {resourceRef: first.resourceRef, view: 'stack_graph'})).code, 'INVALID_INPUT');
    assert.equal((await f.engine.execute('get_resource', {resourceRef, view: 'compose'})).code, 'INVALID_INPUT');
    assert.equal(f.requests.length, before);
  }
});

test('Stack graph: cross-project nodes, hidden endpoints, payloads, bounds and changed authority fail closed without fallback', async () => {
  const variants = [
    graph => { graph.nodes[1].accountId = 'foreign'; }, graph => { graph.edges[0].targetId = 'hidden'; },
    graph => { graph.nodes[0].dockerCompose = secret; }, graph => { graph.hiddenCount = 7; },
    graph => { graph.nodes.push({...graph.nodes[0]}); }, graph => { graph.nodes[0].type = 'loadBalancerService'; },
    graph => { graph.completeness = 'complete'; }, graph => { graph.limitReached = true; },
    graph => { graph.nodes = Array.from({length: 33}, (_, index) => ({...graph.nodes[0], id: 's' + index})); },
  ];
  for (const mutate of variants) {
    const f = stackGraphFixture(), resourceRef = (await f.engine.execute('find_resources', {family: 'stack'})).items[0].resourceRef;
    f.faults.graph = structuredClone(f.graph); mutate(f.faults.graph);
    const result = await f.engine.execute('get_resource', {resourceRef, view: 'stack_graph'});
    assert.equal(result.code, 'INVALID_RESPONSE'); assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(f.requests.filter(request => request.data?.view === 'stack_graph').length, 1);
  }
  for (const code of ['ApiKeyPolicyChanged', 'ApiKeyRevoked', 'OwnerPermissionDenied']) {
    const f = stackGraphFixture(), resourceRef = (await f.engine.execute('find_resources', {family: 'stack'})).items[0].resourceRef;
    f.faults.error = {status: 403, body: {code}};
    assert.equal((await f.engine.execute('get_resource', {resourceRef, view: 'stack_graph'})).code, 'FORBIDDEN');
    assert.equal(f.requests.filter(request => request.data?.view).length, 1);
  }
  const f = stackGraphFixture(), resourceRef = (await f.engine.execute('find_resources', {family: 'stack'})).items[0].resourceRef;
  f.faults.graph = {...f.graph, nodes: [], edges: []};
  const empty = await f.engine.execute('get_resource', {resourceRef, view: 'stack_graph'});
  assert.equal(empty.graph.completeness, 'unknown'); assert.equal(empty.graph.limitReached, false); assert.match(empty.nextStep, /Never infer/);
  f.snapshot.projectId = f.snapshot.schemaProjectId = 'foreign';
  const count = f.requests.length;
  assert.equal((await f.engine.execute('get_resource', {resourceRef, view: 'stack_graph'})).code, 'STALE_REFERENCE'); assert.equal(f.requests.length, count);
});
