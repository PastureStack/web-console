import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandContext, CommandEngine, COMMANDS, safeCatalogQuestions, catalogLaunchPlanSummary} from '../bridge/shared-modules.mjs';
import {allowedRequest} from '../bridge/core.mjs';

const secret = 'CATALOG_DEFAULT_OR_HUMAN_PASSWORD_MUST_NOT_LEAVE';
const templateId = 'ctm-' + 'a'.repeat(64), versionId = 'cvm-' + 'b'.repeat(64);
const optionsRef = 'acopts-11111111-1111-1111-1111-111111111111';
const planId = 'aicataloglaunch-22222222-2222-2222-2222-222222222222';
const definition = (name, type = 'string', extra = {}) => ({name, type, label: name, description: 'Untrusted template input', required: false,
  requiresHuman: type === 'human', sourceType: type, ...extra});
const questions = [definition('text'), definition('enabled', 'boolean'), definition('replicas', 'int', {min: 0, max: 10}),
  definition('ratio', 'float', {min: 0, max: 1}), definition('mode', 'enum', {options: ['small', 'large']}),
  definition('existingSecret', 'reference', {sourceType: 'secret', referenceType: 'secret'}),
  definition('password', 'human', {sourceType: 'password', required: true, default: secret})];
function fixture({optionsError, previewError, applyError, applyResponse, handler, launchEnabled=true, requiredOperations=['read','create','update'], questionDefinitions=questions} = {}) {
  const snapshot = {generation: 'g1', accountId: 'actor', projectId: 'p1', schemaProjectId: 'p1', schemaGeneration: 1, route: '/catalog'};
  let sequence = 0, plan;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], audits = [], published = [];
  const engine = new CommandEngine({context, transportKind: 'stdio', wait: async () => {}, ensureSession: async () => {},
    audit: async event => { audits.push(event); return {accepted: true, requestId: 'a-' + audits.length}; }, onPlan: value => published.push(value),
    request: async request => {
      requests.push(request);
      if (handler) return handler(request);
      if (request.url.endsWith('/aiCatalogMetadataViews')) return {body: {resourceType: 'catalogTemplateVersion', data: [{id: versionId, type: 'catalogTemplateVersion',
        templateId, version: '1.0', revision: 1}], nextMarker: null}};
      if (request.url.endsWith('/aiCatalogStackLaunchOptions')) {
        if (optionsError) throw optionsError;
        return {body: {optionsRef, launchEnabled, requiredOperations, questions:questionDefinitions, files: secret, answers: {password: secret}}};
      }
      if (request.url.endsWith('/aiCatalogStackLaunchPlans')) {
        if (previewError) throw previewError;
        const summary = {stackName: request.data.name, templateKey: 'database', templateName: 'Database', catalogScope: 'global', catalogId: 'library', version: '1.0', revision: 1,
          serviceCount: 1, volumeCount: 2, startsServices: request.data.startOnCreate};
        plan = {id: planId, type: 'aiCatalogStackLaunchPlan', status: 'needs_user', confirmationState: 'pending', verifiedResult: false,
          requiresHumanConfirmation: true, inputsReady: false, summary, missingHumanInputs: [questions[6]], expiresAt: '2026-10-30T12:00:00Z',
          changes: [{field: 'name', before: null, after: summary.stackName}, {field: 'catalogTemplate', before: null, after: 'database'},
            {field: 'catalogVersion', before: null, after: '1.0'}, {field: 'serviceCount', before: null, after: 1}, {field: 'volumeCount', before: null, after: 2},
            {field: 'startOnCreate', before: null, after: summary.startsServices}, {field: 'humanInputCount', before: null, after: 1}]};
        return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('?action=confirm')) {
        plan.confirmationState = 'approved'; plan.inputsReady = true; plan.missingHumanInputs = []; return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('?action=apply')) {
        if (applyError) throw applyError;
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'CatalogLaunchNeedsConfirmation'}};
        if (applyResponse !== undefined) {plan.status='accepted';return {body:applyResponse};}
        plan.status = 'accepted'; return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('/' + planId)) {
        plan.status = 'succeeded'; plan.verifiedResult = true; plan.createdResource = {resourceType: 'stack', id: 'created-stack', name: plan.summary.stackName};
        return {body: structuredClone(plan)};
      }
      throw Error('Unexpected Catalog launch fixture route');
    },
  });
  const captured = context.capture();
  const target = {id: versionId, parentId: templateId, family: 'catalog', resourceType: 'catalogTemplateVersion', scope: 'project',
    catalogPath: 'Environment/global/library/database/Database/1.0', catalogIdentity: {templateKey: 'database', catalogScope: 'global', catalogId: 'library', version: '1.0', revision: 1}};
  const versionRef = context.reference('resource', target, captured);
  return {engine, context, snapshot, requests, audits, published, versionRef, target, plan: () => plan};
}
const detail = f => f.engine.execute('get_resource', {resourceRef: f.versionRef});
const preview = (f, answers = [], parameters = {}) => f.engine.execute('preview_resource_change', {resourceType: 'stack', operation: 'create_from_catalog',
  catalogVersionRef: f.versionRef, parameters: {name: 'owned-catalog', answers, ...parameters}});

test('Catalog launch: safe version options expose opaque questions and no defaults answers files raw IDs or private options ref', async () => {
  const f = fixture(), result = await detail(f);
  assert.equal(COMMANDS.length, 12); assert.equal(result.status, 'succeeded');
  assert.equal(result.launchOptions.questions.length, 7);
  assert.equal(result.launchOptions.questions[6].requiresHuman, true);
  const serialized = JSON.stringify({result, refs: [...f.context.references.values()], audits: f.audits});
  assert.equal(serialized.includes(secret), false); assert.equal(JSON.stringify(result).includes(optionsRef), false);
  for (const raw of [templateId, versionId]) assert.equal(JSON.stringify(result).includes(raw), false);
  assert.deepEqual(f.requests[1].data, {templateId, versionId});
  assert.equal(f.requests[1].url, 'projects/p1/aiCatalogStackLaunchOptions');
  const denied = fixture({optionsError: {status: 403, body: {message: secret}}}), read = await detail(denied);
  assert.equal(read.status, 'succeeded'); assert.equal(read.fields.version, '1.0'); assert.equal(read.launchOptions.code, 'FORBIDDEN');
});

test('Catalog launch: typed scalars and authorized resource refs create exact owner payload while human inputs remain omitted', async () => {
  const f = fixture(), read = await detail(f), q = read.launchOptions.questions;
  const resourceRef = f.context.reference('resource', {id: 'secret-wire-id', family: 'secrets', resourceType: 'secret', scope: 'project'}, f.context.capture());
  const answers = [{questionRef: q[0].questionRef, value: 'hello'}, {questionRef: q[1].questionRef, value: false}, {questionRef: q[2].questionRef, value: 2},
    {questionRef: q[3].questionRef, value: .5}, {questionRef: q[4].questionRef, value: 'large'}, {questionRef: q[5].questionRef, resourceRef}];
  const result = await preview(f, answers, {startOnCreate: false});
  assert.equal(result.status, 'needs_user'); assert.equal(result.planKind, 'catalog-launch'); assert.equal(result.inputsReady, false);
  assert.equal(result.missingHumanInputCount, 1); assert.equal(f.published.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[2].data)), {templateId, versionId, optionsRef, name: 'owned-catalog', startOnCreate: false,
    answers: {text: 'hello', enabled: false, replicas: 2, ratio: .5, mode: 'large'}, referenceBindings: {existingSecret: 'secret-wire-id'}});
  assert.equal(JSON.stringify(result).includes('secret-wire-id'), false);
  assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(JSON.stringify(f.audits).includes('hello'), false);
});

test('Catalog launch: required operations describe real read create and update preflight without granting permission',async()=>{
  const f=fixture({previewError:{status:403,body:{code:'PermissionDenied',message:secret}}}),read=await detail(f);
  assert.deepEqual(read.launchOptions.requiredOperations,['read','create','update']);
  assert.equal(read.launchOptions.authorization,'requires-server-check');
  assert.match(read.nextStep,/service links/);assert.match(read.nextStep,/target scope requires read, create and update/);
  assert.equal((await preview(f)).code,'FORBIDDEN');assert.equal(f.published.length,0);assert.equal(f.plan(),undefined);
  assert.equal(f.requests.filter(request=>request.url.endsWith('?action=apply')).length,0);
  for(const requiredOperations of [undefined,[],['create'],['create','update'],['create','delete'],['create','update','delete']]){
    const invalid=fixture({requiredOperations:requiredOperations===undefined?null:requiredOperations}),result=await detail(invalid);
    assert.equal(result.status,'succeeded');assert.equal(result.fields.version,'1.0');assert.equal(result.launchOptions.code,'INVALID_RESPONSE');
  }
});

test('Catalog launch: unsupported external volume graph gives a bounded console repair hint without publishing or applying a plan',async()=>{
  const f=fixture({previewError:{status:422,body:{code:'CatalogLaunchUnsupported',message:secret}}}),read=await detail(f);
  assert.match(read.nextStep,/external=true/);
  const result=await preview(f);assert.equal(result.code,'UNAVAILABLE');assert.equal(result.status,'rejected');
  assert.match(result.nextStep,/external=true/);assert.match(result.nextStep,/pending support/);assert.match(result.nextStep,/normal console/);
  assert.equal(f.published.length,0);assert.equal(f.plan(),undefined);assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(f.requests.filter(request=>request.url.includes('?action=')).length,0);
});

test('Catalog launch: human values wrong scalar types duplicate questions raw IDs and YAML never reach preview transport', async () => {
  const f = fixture(), read = await detail(f), q = read.launchOptions.questions;
  const cases = [[{questionRef: q[6].questionRef, value: secret}], [{questionRef: q[1].questionRef, value: 'false'}],
    [{questionRef: q[2].questionRef, value: 1.2}], [{questionRef: q[3].questionRef, value: 2}], [{questionRef: q[4].questionRef, value: 'guess'}],
    [{questionRef: q[5].questionRef, value: 'secret-wire-id'}], [{questionRef: q[0].questionRef, value: 'a', resourceRef: 'raw-id'}],
    [{questionRef: q[0].questionRef, value: 'a'}, {questionRef: q[0].questionRef, value: 'b'}]];
  for (const answers of cases) {
    const result = await preview(f, answers);
    assert.ok(['NEEDS_USER', 'INVALID_INPUT'].includes(result.code)); assert.equal(JSON.stringify(result).includes(secret), false);
  }
  const bad = await preview(f, [], {dockerCompose: secret}); assert.equal(bad.code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 2); assert.equal(f.published.length, 0);
  const old = q[0].questionRef; f.target.catalogOptions.optionsRef = 'acopts-33333333-3333-3333-3333-333333333333';
  assert.equal((await preview(f, [{questionRef: old, value: 'old'}])).code, 'STALE_REFERENCE'); assert.equal(f.requests.length, 2);
});

test('Catalog launch: lost apply preserves one operation ref and observes the same durable plan without resubmission', async () => {
  const f = fixture({applyError: Error(secret)}); await detail(f); const planned = await preview(f);
  // The human-only form/approval is covered by UI tests; observe its durable
  // approved receipt here before exercising an uncertain write response.
  f.plan().inputsReady = true; f.plan().missingHumanInputs = [];
  assert.equal((await f.engine.confirmPlan(planned.planRef)).confirmationState, 'approved');
  const result = await f.engine.execute('apply_resource_change', {planRef: planned.planRef});
  assert.equal(result.status, 'unknown'); assert.ok(result.operationRef);
  const recovered = await f.engine.execute('get_operation', {operationRef: result.operationRef});
  assert.equal(recovered.status, 'succeeded'); assert.equal(recovered.verifiedResult, true); assert.ok(recovered.createdResource.resourceRef);
  assert.equal(JSON.stringify(recovered).includes('created-stack'), false);
  assert.equal(f.requests.filter(request => request.url.endsWith('?action=apply')).length, 1);
  assert.ok(f.requests.at(-1).url.endsWith('/aiCatalogStackLaunchPlans/' + planId));
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test('Catalog launch: options and plans fail closed after context change and private secret question definitions are never retained', async () => {
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; }), pending = new Promise(resolve => { release = resolve; });
  const f = fixture({handler: request => request.url.endsWith('/aiCatalogMetadataViews') ? {body: {resourceType: 'catalogTemplateVersion', data: [{id: versionId, type: 'catalogTemplateVersion', templateId, version: '1.0', revision: 1}]}} : (entered(), pending)});
  const resultPromise = detail(f); await waiting; f.snapshot.generation = 'g2'; f.snapshot.accountId = 'other';
  release({body: {optionsRef, launchEnabled: true, requiredOperations:['read','create','update'], questions}});
  const result = await resultPromise; assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal('launchOptions' in result, false);
  const normalized = safeCatalogQuestions([definition('api_token', 'enum', {options: [secret], default: secret})]);
  assert.equal(normalized[0].requiresHuman, true); assert.equal(JSON.stringify(normalized).includes(secret), false);
});

test('Catalog launch: ready inputs and start effects must match the authoritative human review', async () => {
  const f=fixture();await detail(f);await preview(f);
  assert.throws(()=>catalogLaunchPlanSummary({...f.plan(),inputsReady:true},null),{code:'INVALID_RESPONSE'});
  const changes=f.plan().changes.map(change=>change.field==='startOnCreate'?{...change,after:false}:change);
  assert.throws(()=>catalogLaunchPlanSummary({...f.plan(),changes},null),{code:'INVALID_RESPONSE'});
});

test('Catalog launch: disabled launch preserves metadata and safe questions without suggesting a mutation retry',async()=>{
  const f=fixture({launchEnabled:false}),read=await detail(f);
  assert.equal(read.status,'succeeded');assert.equal(read.fields.version,'1.0');assert.equal(read.launchOptions.launchEnabled,false);
  assert.match(read.nextStep,/launch is disabled/);
  assert.equal((await preview(f)).code,'UNAVAILABLE');assert.equal(f.requests.length,2);
});

test('Catalog launch: repair hints refer to Catalog name questions and human input rather than direct resource create',async()=>{
  const f=fixture(),read=await detail(f);
  assert.match((await preview(f,[],{name:'a'.repeat(64)})).nextStep,/63 ASCII/);
  assert.match((await preview(f,[],{description:null})).nextStep,/null is not accepted/);
  assert.match((await preview(f,[{questionRef:read.launchOptions.questions[6].questionRef,value:'not-sent'}])).nextStep,/console/);
  const stale=await f.engine.execute('preview_resource_change',{resourceType:'stack',operation:'create_from_catalog',catalogVersionRef:'stale',parameters:{name:'requested'}});
  assert.match(stale.nextStep,/catalogVersionRef/);assert.match(stale.nextStep,/questionRefs/);assert.equal(f.requests.length,2);
});

test('Catalog launch: unavailable dispatch response remains unknown with the same recoverable operation ref',async()=>{
  const f=fixture({applyError:{status:503,body:{code:'CatalogLaunchUnavailable',message:secret}}});await detail(f);const planned=await preview(f);
  f.plan().inputsReady=true;f.plan().missingHumanInputs=[];await f.engine.confirmPlan(planned.planRef);
  const outcome=await f.engine.execute('apply_resource_change',{planRef:planned.planRef});
  assert.equal(outcome.status,'unknown');assert.ok(outcome.operationRef);assert.equal(JSON.stringify(outcome).includes(secret),false);
  const recovered=await f.engine.execute('get_operation',{operationRef:outcome.operationRef});
  assert.equal(recovered.status,'succeeded');assert.equal(f.requests.filter(request=>request.url.endsWith('?action=apply')).length,1);
});

test('Catalog launch: an optional reference can explicitly select none without a raw resource ID or hidden default',async()=>{
  const f=fixture(),read=await detail(f),q=read.launchOptions.questions[5];
  const result=await preview(f,[{questionRef:q.questionRef,value:''}]);
  assert.equal(result.status,'needs_user');assert.deepEqual(JSON.parse(JSON.stringify(f.requests.at(-1).data.referenceBindings)),{existingSecret:''});
  assert.equal(JSON.stringify(f.published).includes(secret),false);
});

test('Catalog launch: numeric answers match the owner safe-number boundary before any preview request',async()=>{
  const f=fixture({questionDefinitions:[definition('amount','float')]}),read=await detail(f),questionRef=read.launchOptions.questions[0].questionRef;
  for(const value of [Number.MAX_SAFE_INTEGER+1,-Number.MAX_SAFE_INTEGER-1,1e20,Infinity,NaN]){
    assert.equal((await preview(f,[{questionRef,value}])).code,'INVALID_INPUT');
  }
  assert.equal(f.requests.length,2);
});

test('Catalog launch: reference answers reuse the shared opaque service resolver and repair stale refs in the correct family',async()=>{
  const f=fixture({questionDefinitions:[definition('serviceTarget','reference',{sourceType:'service',referenceType:'service'})]});
  const read=await detail(f),questionRef=read.launchOptions.questions[0].questionRef;
  const serviceRef=f.context.reference('service',{id:'authorized-service-wire'},f.context.capture());
  assert.equal((await preview(f,[{questionRef,resourceRef:serviceRef}])).status,'needs_user');
  assert.equal(f.requests.at(-1).data.referenceBindings.serviceTarget,'authorized-service-wire');
  const stale=await preview(f,[{questionRef,resourceRef:'authorized-service-wire'}]);
  assert.equal(stale.code,'STALE_REFERENCE');assert.equal(stale.field,'parameters.answers');assert.match(stale.nextStep,/find_resources/);
  assert.equal(f.requests.length,3);
});

test('Catalog launch: bridge fixed routes prohibit all human completion confirmation cancellation and arbitrary material', () => {
  assert.equal(allowedRequest('projects/p1/aiCatalogStackLaunchOptions', 'POST', 'p1'), true);
  assert.equal(allowedRequest('projects/p1/aiCatalogStackLaunchPlans', 'POST', 'p1'), true);
  assert.equal(allowedRequest('projects/p1/aiCatalogStackLaunchPlans/' + planId + '?action=apply', 'POST', 'p1'), true);
  for (const action of ['completeInputs', 'confirm', 'cancel']) assert.equal(allowedRequest('projects/p1/aiCatalogStackLaunchPlans/' + planId + '?action=' + action, 'POST', 'p1'), false);
  assert.equal(allowedRequest('projects/p2/aiCatalogStackLaunchOptions', 'POST', 'p1'), false);
  assert.equal(allowedRequest('projects/p1/aiCatalogStackLaunchOptions?url=http://elsewhere', 'POST', 'p1'), false);
});

test('Catalog launch: failed source or unsupported receipts explain repair while preserving the existing operation',async()=>{
  const f=fixture();await detail(f);await preview(f);
  for(const reason of ['CatalogLaunchSourceChanged','CatalogLaunchPlanExpired','CatalogLaunchUnsupported']){
    const result=f.engine.operationSummary({...f.plan(),status:'failed',reason},'existing-operation');
    assert.equal(result.status,'failed');assert.equal(result.operationRef,'existing-operation');
    assert.equal(result.code,reason==='CatalogLaunchUnsupported'?'UNAVAILABLE':'CONFLICT');
    assert.match(result.nextStep,reason==='CatalogLaunchUnsupported'?/normal console/:/questionRefs/);
  }
  assert.equal(f.requests.filter(request=>request.url.endsWith('?action=apply')).length,0);
});

test('Catalog launch: malformed successful apply response stays unknown and recovers the same plan without another apply',async()=>{
  const f=fixture({applyResponse:{id:'unexpected',private:secret}});await detail(f);const planned=await preview(f);
  const observations=[];f.engine.onOperation=event=>observations.push(event);
  f.plan().inputsReady=true;f.plan().missingHumanInputs=[];await f.engine.confirmPlan(planned.planRef);
  const result=await f.engine.execute('apply_resource_change',{planRef:planned.planRef});
  assert.equal(result.status,'unknown');assert.ok(result.operationRef);assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(observations[0].status,'unknown');assert.equal(observations[0].planId,planId);
  const recovered=await f.engine.execute('get_operation',{operationRef:result.operationRef});
  assert.equal(recovered.status,'succeeded');assert.equal(recovered.verifiedResult,true);
  assert.equal(f.requests.filter(request=>request.url.endsWith('?action=apply')).length,1);
});

test('combined seam: Catalog creation and Archive restore keep separate closed descriptors and plan contracts',async()=>{
  const f=fixture({handler:request=>({body:{id:'aichange-11111111-1111-1111-1111-111111111111',resourceType:request.data.resourceType,
    resourceId:request.data.resourceId,operation:request.data.operation,targetPath:'Environment/Stack/Service',status:'preview',confirmationState:'pending',
    changes:[{field:'archived',before:request.data.operation==='restore',after:request.data.operation==='archive'}]}})});
  const captured=f.context.capture(),targetRef=f.context.reference('resource',{id:'service-wire',resourceType:'service',family:'service',scope:'project'},captured);
  for(const operation of ['archive','restore']){
    const result=await f.engine.execute('preview_resource_change',{resourceType:'service',operation,targetRef,parameters:{}});
    assert.equal(result.status,'needs_user');assert.equal(result.planKind,'resource-change');assert.equal(result.displayDiff[0].field,'archived');
    assert.deepEqual(f.requests.at(-1).data,{resourceType:'service',operation,resourceId:'service-wire',parameters:{}});
    assert.equal(f.requests.at(-1).url,'projects/p1/aiResourceChangePlans');
  }
  const before=f.requests.length;
  assert.equal((await f.engine.execute('preview_resource_change',{resourceType:'container',operation:'archive',targetRef,parameters:{}})).code,'INVALID_INPUT');
  assert.equal((await f.engine.execute('preview_resource_change',{resourceType:'service',operation:'archive',targetRef,catalogVersionRef:f.versionRef,parameters:{}})).code,'INVALID_INPUT');
  assert.equal(f.requests.length,before);
  assert.equal(f.engine.planCollection({planKind:'catalog-launch'}),'aiCatalogStackLaunchPlans');
  assert.equal(f.engine.planCollection({planKind:'resource-change'}),'aiResourceChangePlans');
  const description=COMMANDS.find(command=>command.name==='preview_resource_change').description;
  assert.match(description,/create_from_catalog/);assert.match(description,/startOnCreate explicitly/);assert.match(description,/archive requires completely stopped/);
});

test('combined seam: Archive Catalog and Global-scale rejection hints remain independent without dispatch or raw error text',async()=>{
  for(const [code,operation,parameters,expected,hint] of [
    ['ArchiveRequiresStopped','archive',{},'CONFLICT',/completely stopped/],
    ['ResourceChangeUnsupported','scale',{scale:2},'UNAVAILABLE',/Global services/],
  ]){
    const f=fixture({handler:()=>{throw {status:422,body:{code,message:secret}};}});
    const targetRef=f.context.reference('resource',{id:'service-wire',resourceType:'service',family:'service',scope:'project'},f.context.capture());
    const result=await f.engine.execute('preview_resource_change',{resourceType:'service',operation,targetRef,parameters});
    assert.equal(result.code,expected);assert.match(result.nextStep,hint);assert.equal(f.requests.length,1);assert.equal(f.published.length,0);
    assert.equal(JSON.stringify(result).includes(secret),false);
  }
  const catalog=fixture({previewError:{status:422,body:{code:'CatalogLaunchUnsupported',message:secret}}});await detail(catalog);
  const rejected=await preview(catalog);assert.equal(rejected.code,'UNAVAILABLE');assert.match(rejected.nextStep,/external=true/);
  assert.equal(catalog.published.length,0);assert.equal(catalog.requests.filter(request=>request.url.includes('?action=apply')).length,0);
});
