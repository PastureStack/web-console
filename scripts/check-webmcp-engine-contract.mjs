import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMMANDS,PUBLIC_ERROR_CODES,RESOURCE_CHANGES,NATIVE_CHANGE_OPERATIONS,BROWSER_LOCAL_INTENTS} from '../bridge/shared-modules.mjs';

async function containedSourcePath(root, relative, message) {
  // Enforce the selected owner before metadata access and again after links
  // resolve; a sibling such as engine-escape is never a child of engine.
  const requested=path.resolve(root,relative);
  if(!requested.startsWith(path.join(root,path.sep)))throw Error(message);
  const canonical=await realpath(requested);
  // relative() retains Windows owner spelling without changing the canonical
  // location; unlike lowercasing a filename, this preserves the actual path.
  const target=path.resolve(root,path.relative(root,canonical));
  if(!target.startsWith(path.join(root,path.sep)))throw Error(message);
  return target;
}
const readContainedSource=async(root,relative,message)=>readFile(await containedSourcePath(root,relative,message),'utf8');

// Optional private backend inputs do not change the twelve Web/Bridge tools.
// All older inputs and every other field/method/role assertion remain exact.
function auditSourceInputNames(schema, required) {
  const inputs=[...required];
  const optional={keyId:{type:'string',create:true,maxLength:128},capabilitiesOnly:{type:'boolean',create:true}};
  for(const [name,specification] of Object.entries(optional)){
    if(!Object.hasOwn(schema.resourceFields,name))continue;
    const field={...schema.resourceFields[name]};
    for(const flag of ['required','update','readOnCreateOnly']){
      if(Object.hasOwn(field,flag)){assert.equal(field[flag],false,'Private Audit '+name+' must stay optional/readable/non-updatable');delete field[flag];}
    }
    assert.deepEqual(field,specification,'Private Audit '+name+' has an unexpected contract');
    inputs.push(name);
  }
  return inputs;
}


// Every public intent must have a closed owner. No unknown operation is filtered away.
export function checkResourceChangeIntentContract(nativeOptions, {
  commands=COMMANDS, resourceChanges=RESOURCE_CHANGES, nativeOperations=NATIVE_CHANGE_OPERATIONS, localIntents=BROWSER_LOCAL_INTENTS,
} = {}) {
  const preview=commands.find(tool=>tool.name==='preview_resource_change').inputSchema;
  const entries=Object.entries(resourceChanges).flatMap(([resourceType, operations])=>
    Object.entries(operations).map(([operation, descriptor])=>({resourceType,operation,...descriptor})));
  const wire=[],local=[],catalog=[];
  for(const intent of entries){
    if(intent.execution==='native-wire'){
      assert.ok(['aiResourceChangePlans','aiCatalogStackLaunchPlans'].includes(intent.wire),'Unknown native wire owner');
      if(intent.wire==='aiResourceChangePlans')wire.push(intent.operation);
      else catalog.push([intent.resourceType,intent.operation]);
    }else if(intent.execution==='browser-human-confirmation')local.push(intent);
    else assert.fail('Unclassified resource-change intent');
  }
  assert.deepEqual(catalog,[['stack','create_from_catalog']],'Catalog owner must not hide other operations');
  const derivedNative=[...new Set(wire)].sort();
  assert.deepEqual([...nativeOperations].sort(),derivedNative,'Native operation index differs from its descriptors');
  assert.deepEqual([...nativeOptions].sort(),derivedNative,'Typed change operation enum mismatch');
  const expectedLocal=[['set_default','account-preference'],['switch_context','browser-context']].map(([operation,effectScope])=>({
    resourceType:'project',operation,fields:[],required:[],minFields:0,execution:'browser-human-confirmation',wire:null,
    transport:'browser',bridge:'manual-handoff',modelApply:'needs_user',effectScope,
  }));
  const byOperation=(a,b)=>a.operation.localeCompare(b.operation);
  assert.deepEqual(local.sort(byOperation),expectedLocal,'Browser intents must retain exact project/human/effect/Bridge bounds');
  assert.deepEqual([...localIntents].sort(byOperation),expectedLocal,'Browser intent index differs from its closed descriptors');
  assert.deepEqual([...preview.properties.operation.enum].sort(),[...new Set(entries.map(intent=>intent.operation))].sort(),
    'Public intent enum must be complete and contain no undeclared operations');
  const conditions=preview.allOf.filter(row=>Array.isArray(row.if?.properties?.operation?.enum) &&
    row.if.properties.operation.enum.some(operation=>local.some(intent=>intent.operation===operation)));
  assert.equal(conditions.length,1,'One closed Browser-local schema condition is required');
  assert.deepEqual(conditions[0],{
    if:{properties:{operation:{enum:local.map(intent=>intent.operation)}},required:['operation']},
    then:{properties:{resourceType:{const:'project'},parameters:{type:'object',properties:{},required:[],additionalProperties:false}},
      required:['targetRef'],not:{anyOf:[{required:['parentRef']},{required:['catalogVersionRef']}]}}},
    'Browser inputs must be project-only opaque selection with empty parameters');
  return {nativeOperations:derivedNative,localIntents:expectedLocal,publicOperations:[...preview.properties.operation.enum]};
}

// This is a source-contract check, not a native authorization/CAS test.
export async function checkContainerNetworkContract(engineRoot) {
  const engine=path.resolve(engineRoot);
  const schemaRoot=await containedSourcePath(engine,'resources/content/schema','Schema root escapes selected Engine');
  const read=async relative=>JSON.parse(await readContainedSource(schemaRoot,relative,'Schema file escapes selected Engine'));
  assert.equal(COMMANDS.length,12,'Container network edits must retain twelve tools');
  const preview=COMMANDS.find(tool=>tool.name==='preview_resource_change').inputSchema;
  for(const type of ['port','instanceLink'])assert.ok(preview.properties.resourceType.enum.includes(type),'Missing typed child '+type);
  for(const operation of ['update_public_port','update_target'])assert.ok(preview.properties.operation.enum.includes(operation),'Missing typed child operation '+operation);
  const parameters=preview.properties.parameters.properties;
  assert.deepEqual(parameters.publicPort.type,['integer','null']);
  assert.equal(parameters.publicPort.minimum,1);assert.equal(parameters.publicPort.maximum,65535);
  assert.equal(Object.hasOwn(parameters.publicPort,'default'),false);
  assert.equal(parameters.targetInstanceRef.type,'string');
  for(const field of ['targetInstanceId','resourceUuid','sourceId','sourceUuid'])assert.equal(Object.hasOwn(parameters,field),false,'Native identity must not become a model parameter');
  const reset=preview.allOf.find(row=>row.if?.properties?.parameters?.required?.includes('resetName'));
  assert.equal(parameters.resetName.const,true);assert.equal(reset?.then.properties.resourceType.const,'host');
  assert.equal(reset.then.properties.operation.const,'update_metadata');assert.deepEqual(reset.then.properties.parameters.not,{required:['name']});
  for(const [type,field] of [['port','publicPort'],['instanceLink','targetInstanceId']]){
    const schema=await read('base/'+type+'.json');
    assert.equal(schema.resourceFields[field]?.attributes?.scheduleUpdate,true,type+'.'+field+' must use native scheduling');
  }
  const user=(await read('user/user-auth.json')).authorize,project=(await read('project/project-auth.json')).authorize;
  for(const field of ['port.publicPort','instanceLink.targetInstanceId'])assert.equal(user[field],'ru','Native child field authority drift: '+field);
  for(const field of ['port.instanceId','port.privatePort','port.protocol','port.bindAddress','instanceLink.instanceId','instanceLink.linkName'])
    assert.equal(user[field],'r','Native preserved child field authority drift: '+field);
  for(const type of ['port','instanceLink'])assert.equal(project[type],'ru','Native project child authority drift: '+type);
  const descriptor=await readContainedSource(engine,'code/iaas/auth-logic/src/main/java/io/cattle/platform/iaas/api/auth/change/AiResourceChangeDescriptor.java','Native descriptor escapes selected Engine');
  const compact=descriptor.replace(/\s+/g,'');
  for(const declaration of [
    'add(result,"port","update_public_port","PUT",null,"update",Set.of("publicPort","resourceUuid","sourceId","sourceUuid"));',
    'add(result,"instanceLink","update_target","PUT",null,"update",Set.of("targetInstanceId","targetInstanceUuid","resourceUuid","sourceId","sourceUuid"));'
  ])assert.ok(compact.includes(declaration),'Native child PUT descriptor must retain exact UUID/parent envelope');
  const native=await readContainedSource(engine,'code/iaas/api-logic/src/main/java/io/cattle/platform/iaas/api/port/PortUpdateService.java','Native Port owner escapes selected Engine');
  const legacy='if(header==null){if(trusted!=null)returntrusted;if(request.getAttribute(REQUIRED)==Required.BEFORE)throwfail(428,"PortUpdatePreconditionRequired");returnnull;}';
  assert.ok(native.replace(/\s+/g,'').includes(legacy),'Legacy header omission and trusted typed CAS must remain distinct');
}

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
export async function checkEngineContract(engineRoot, {catalogOptionsOnly = false, externalTcpOnly = false, containerNetworkOnly = false} = {}) {
const engine=path.resolve(engineRoot);
const schemaRoot=await containedSourcePath(engine,'resources/content/schema','Schema root escapes selected Engine');
const read=async relative=>JSON.parse(await readContainedSource(schemaRoot,relative,'Schema file escapes selected Engine'));
if(containerNetworkOnly){await checkContainerNetworkContract(engine);return;}
if(externalTcpOnly){
  const external=await read('base/externalService.json'),user=await read('user/user-auth.json');
  assert.equal(external.resourceFields.healthCheck.type,'instanceHealthCheck','External health check must retain its native type');
  assert.equal(user.authorize['externalService.healthCheck'],'cr','External health check is native create/read, never update');
  const tool=COMMANDS.find(item=>item.name==='preview_resource_change');
  const condition=tool.inputSchema.allOf.find(item=>item.if?.properties?.resourceType?.const==='externalService');
  assert.ok(condition,'External health-check condition must be declared');
  const check=condition.then.properties.parameters.properties.healthCheck;
  assert.equal(condition.then.properties.operation.const,'create');assert.equal(check.additionalProperties,false);
  assert.deepEqual(check.required,['port']);
  assert.deepEqual(Object.keys(check.properties).sort(),['port','interval','responseTimeout','healthyThreshold','unhealthyThreshold','requestLine'].sort());
  const model=await readContainedSource(engine,'code/iaas/model/src/main/java/io/cattle/platform/core/addon/InstanceHealthCheck.java',
    'Native health model escapes selected Engine');
  assert.match(model,/@Field\(required = true, min = 1, max = 65535\)\s+public Integer getPort\(\)/);
  assert.equal(check.properties.port.minimum,1);assert.equal(check.properties.port.maximum,65535);
  assert.match(model,/@Field\(nullable = true\)\s+public String getRequestLine\(\)/,'Native HTTP request line must remain readable/nullable');
  assert.equal(check.properties.requestLine.type,'string');assert.equal(check.properties.requestLine.minLength,0);
  assert.equal(check.properties.requestLine.maxLength,1024);assert.equal(check.properties.requestLine.pattern,'^[^\\u0000\\r\\n]*$');
  assert.equal(Object.hasOwn(check.properties.requestLine,'default'),false);
  for(const name of ['interval','responseTimeout','healthyThreshold','unhealthyThreshold']){
    assert.match(model,new RegExp('Integer '+name+';'),'Native '+name+' must retain Integer precision');
    // A positive typed subset; native Integer metadata supplies no timing default.
    assert.equal(check.properties[name].type,'integer');assert.equal(check.properties[name].minimum,1);
    assert.equal(check.properties[name].maximum,2147483647);assert.equal(Object.hasOwn(check.properties[name],'default'),false);
  }
  return;
}
if(!catalogOptionsOnly){
  await checkContainerNetworkContract(engine);
  const event=await read('base/aiToolCallEvent.json');
  assert.deepEqual([...event.resourceFields.command.options].sort(),[...COMMANDS.map(t=>t.name),'unknown'].sort(),'Tool audit wire enum does not match the frontend');
  for(const code of [...PUBLIC_ERROR_CODES,'NONE'])assert.ok(event.resourceFields.reason.options.includes(code),'Public error '+code+' cannot be audited');
}
const wireInputs={aiServiceUpgradePlan:['serviceId','image','startFirst','batchSize','intervalMillis','ports','healthCheck','command','entryPoint'],aiServiceDescriptionUpdate:['serviceId','description','expectedDescription'],
  aiToolCallEvent:['command','phase','status','reason','correlationId'],aiResourceView:['resourceType','resourceId','query','marker','parentId','view','tailLines'],
  aiResourceChangePlan:['resourceType','operation','resourceId','parameters'],aiCatalogMetadataView:['query','marker','templateId','versions','versionId'],
  aiCatalogStackLaunchOptions:['templateId','versionId'],
  aiCatalogStackLaunchPlan:['templateId','versionId','optionsRef','name','description','startOnCreate','answers','referenceBindings'],
  aiCatalogStackLaunchInputs:['answers','referenceBindings'],
  aiAuditQuery:['keyId','environmentId','from','to','lastMinutes','decision','outcome','operation','targetType','requestId','httpStatus','limit','offset','eventId'],
  aiAuditSourcePageInput:['limit','marker','projectId','accountId','from','to','keyKind']};
for(const [type,requiredInputs] of Object.entries(wireInputs)){
  if(catalogOptionsOnly&&type!=='aiCatalogStackLaunchOptions')continue;
  const schema=await read('base/'+type+'.json');
  const actionInput=type==='aiCatalogStackLaunchInputs';
  const auditQuery=type==='aiAuditQuery',auditSource=type==='aiAuditSourcePageInput',audit=auditQuery||auditSource;
  const inputs=auditSource?auditSourceInputNames(schema,requiredInputs):requiredInputs;
  if(actionInput){assert.deepEqual(schema.collectionMethods,[],'Human input must not have its own collection route');assert.deepEqual(schema.resourceMethods,[],'Human input must not have its own resource route');}
  else if(auditSource){assert.deepEqual(schema.collectionMethods,[],'Private Audit input must not have its own collection route');assert.deepEqual(schema.resourceMethods,[],'Private Audit input must not have its own resource route');}
  else assert.ok(schema.collectionMethods.includes('POST'),type+' is not a POST input contract');
  for(const name of inputs)assert.equal(schema.resourceFields[name]?.create,true,type+'.'+name+' is not accepted input');
  if(type==='aiServiceUpgradePlan'){
    const properties=COMMANDS.find(tool=>tool.name==='preview_service_upgrade').inputSchema.properties;
    for(const name of ['startFirst','batchSize','intervalMillis']){
      const field=schema.resourceFields[name],spec=properties[name];
      assert.equal(field.type,spec.type==='integer'?'int':spec.type,type+'.'+name+' type mismatch');
      assert.equal(field.update,false,type+'.'+name+' must not be client-updatable');
      assert.equal(field.nullable,false,type+'.'+name+' must reject null');
      assert.notEqual(field.required,true,type+'.'+name+' must remain optional');
      if(spec.type==='integer'){
        assert.equal(field.min,spec.minimum,type+'.'+name+' minimum mismatch');
        assert.equal(field.max,spec.maximum,type+'.'+name+' precision mismatch');
      }
    }
    assert.notEqual(schema.resourceFields.image.required,true,type+'.image must remain optional');
    for(const [name,kind,nullable] of [['ports','array[string]',false],['healthCheck','json',true],['command','array[string]',true],['entryPoint','array[string]',true]]){
      const field=schema.resourceFields[name];
      assert.equal(field.type,kind,type+'.'+name+' type mismatch');
      assert.equal(field.update,false,type+'.'+name+' must not be client-updatable');
      assert.equal(field.nullable,nullable,type+'.'+name+' null semantics mismatch');
      assert.notEqual(field.required,true,type+'.'+name+' must remain optional');
    }
    assert.equal(schema.resourceFields.configurationChanges?.type,'array[json]',type+' must return configuration review');
    assert.equal(schema.resourceFields.configurationChanges.create,false,type+'.configurationChanges must be read-only output');
    assert.equal(schema.resourceFields.configurationChanges.update,false,type+'.configurationChanges must not be client-updatable');
    assert.equal(schema.resourceFields.upgradeStrategy?.type,'json',type+' must return effective strategy');
    assert.equal(schema.resourceFields.upgradeStrategy.create,false,type+'.upgradeStrategy must be read-only output');
    assert.equal(schema.resourceFields.upgradeStrategy.update,false,type+'.upgradeStrategy must not be client-updatable');
  }
  if(type==='aiResourceChangePlan'){
    const properties=COMMANDS.find(tool=>tool.name==='preview_resource_change').inputSchema.properties;
    // Catalog launch has its own closed collection and input contract; it must
    // never be silently admitted by the ordinary lifecycle plan endpoint.
    assert.deepEqual([...schema.resourceFields.resourceType.options].sort(),[...properties.resourceType.enum].sort(),
      'Typed change resourceType enum mismatch');
    checkResourceChangeIntentContract(schema.resourceFields.operation.options);
    assert.equal(schema.resourceFields.parameters.type,'json','Typed parameters must preserve JSON values');
  }
  if(type==='aiResourceView'){
    const field=schema.resourceFields.view;
    const tool=COMMANDS.find(item=>item.name==='get_resource').inputSchema;
    assert.equal(field.type,'string');assert.equal(field.maxLength,32);
    assert.deepEqual(field.options,['stack_graph','container_logs','bridge_context']);assert.notEqual(field.required,true);assert.notEqual(field.update,true);
    assert.deepEqual(Object.keys(tool.properties).sort(),['resourceRef','tailLines','view']);
    // Environment bootstrap is a private Bridge read, never a public get_resource mode.
    assert.equal(tool.properties.view.type,'string');assert.deepEqual(tool.properties.view.enum,['stack_graph','container_logs']);
    assert.deepEqual(tool.required,['resourceRef']);assert.equal(tool.additionalProperties,false);
    const tail=schema.resourceFields.tailLines,limit=tool.properties.tailLines;
    assert.equal(tail.type,'int');assert.equal(tail.min,1);assert.equal(tail.max,200);
    assert.notEqual(tail.required,true);assert.notEqual(tail.update,true,'Container logs tailLines must not be client-updatable');
    assert.equal(limit.type,'integer');assert.equal(limit.minimum,1);assert.equal(limit.maximum,200);
    const logs=schema.resourceFields.logs;
    assert.equal(logs.type,'map[json]');assert.equal(logs.create,false,'Container logs must be read-only output');
    assert.notEqual(logs.update,true,'Container logs must not be client-updatable');
    assert.notEqual(logs.readOnCreateOnly,true,'Container logs output must stay readable');
  }
  if(type==='aiCatalogMetadataView'){
    for(const [name,limit] of Object.entries({query:256,marker:128,templateId:68,versionId:68})){
      assert.equal(schema.resourceFields[name].type,'string','Catalog '+name+' must be a bounded string');
      assert.equal(schema.resourceFields[name].maxLength,limit,'Catalog '+name+' bound mismatch');
    }
    assert.equal(schema.resourceFields.versions.type,'boolean','Catalog versions must be an explicit boolean');
  }
  if(audit){
    const outputs=auditQuery?{resourceType:'string',data:'array[json]',total:'int',nextOffset:'int',range:'map[string]',payloadPolicy:'string'}:{};
    assert.deepEqual(Object.keys(schema.resourceFields).sort(),[...inputs,...Object.keys(outputs)].sort(),type+' must retain its closed field set');
    assert.deepEqual(Object.keys(schema.resourceActions||{}),[],type+' must not expose resource actions');
    assert.deepEqual(Object.keys(schema.collectionActions||{}),[],type+' must not expose collection actions');
    if(auditQuery){
      assert.equal(schema.pluralName,'aiAuditQueries');assert.deepEqual(schema.collectionMethods,['POST'],type+' must be POST-only');assert.deepEqual(schema.resourceMethods,[],type+' must not expose resource methods');
    }
    for(const name of inputs){
      const field=schema.resourceFields[name],kind=auditSource?(name==='limit'?'int':name==='keyKind'?'enum':name==='capabilitiesOnly'?'boolean':'string'):['lastMinutes','httpStatus','limit','offset'].includes(name)?'int':'string';
      assert.equal(field.type,kind,type+'.'+name+' type mismatch');
      assert.notEqual(field.update,true,type+'.'+name+' must not be client-updatable');
      if(kind==='string')assert.equal(field.maxLength,auditSource?['from','to'].includes(name)?64:128:160,type+'.'+name+' bound mismatch');
    }
    if(auditSource){
      assert.equal(schema.resourceFields.limit.min,1,type+'.limit minimum mismatch');assert.equal(schema.resourceFields.limit.max,1000,type+'.limit maximum mismatch');
      assert.deepEqual([...schema.resourceFields.keyKind.options].sort(),['apiKey','apiKeyRestricted'],type+'.keyKind enum mismatch');
    }
    for(const [name,kind] of Object.entries(outputs)){
      const field=schema.resourceFields[name];assert.equal(field.type,kind,type+'.'+name+' type mismatch');
      assert.equal(field.create,false,type+'.'+name+' must be read-only output');assert.notEqual(field.update,true,type+'.'+name+' must not be client-updatable');
    }
  }
  const catalogLaunch=type.startsWith('aiCatalogStackLaunch');
  if(catalogLaunch){
    const field=(name,kind)=>assert.equal(schema.resourceFields[name]?.type,kind,type+'.'+name+' type mismatch');
    if(!actionInput){
      for(const name of ['templateId','versionId']){field(name,'string');assert.equal(schema.resourceFields[name].required,true,type+'.'+name+' must be required');assert.equal(schema.resourceFields[name].maxLength,68,type+'.'+name+' bound mismatch');}
    }
    if(type==='aiCatalogStackLaunchOptions'){
      assert.equal(schema.pluralName,'aiCatalogStackLaunchOptions');
      assert.deepEqual(schema.collectionMethods,['POST']);assert.deepEqual(schema.resourceMethods,[]);
      for(const [name,kind] of Object.entries({questions:'array[json]',optionsRef:'string',launchEnabled:'boolean',requiredOperations:'array[string]',resourceTextIsUntrusted:'boolean'}))field(name,kind);
    }else{
      field('answers','map[json]');field('referenceBindings','map[string]');
      if(actionInput)assert.deepEqual(Object.keys(schema.resourceFields).sort(),['answers','referenceBindings']);
      else{
        assert.equal(schema.pluralName,'aiCatalogStackLaunchPlans');assert.deepEqual([...schema.collectionMethods].sort(),['GET','POST']);assert.deepEqual(schema.resourceMethods,['GET']);
        assert.deepEqual(Object.keys(schema.resourceActions).sort(),['apply','cancel','completeInputs','confirm']);
        assert.deepEqual(schema.resourceActions.completeInputs,{input:'aiCatalogStackLaunchInputs',output:'aiCatalogStackLaunchPlan'});
        for(const [name,kind] of Object.entries({optionsRef:'string',name:'string',description:'string',startOnCreate:'boolean',status:'string',reason:'string',verifiedResult:'boolean',requiresHumanConfirmation:'boolean',confirmationState:'string',inputsReady:'boolean',summary:'json',changes:'array[json]',missingHumanInputs:'array[json]',expiresAt:'date',createdResource:'json',resourceTextIsUntrusted:'boolean'}))field(name,kind);
        for(const name of ['optionsRef','name','startOnCreate'])assert.equal(schema.resourceFields[name].required,true,type+'.'+name+' must be required');
        for(const [name,limit] of Object.entries({optionsRef:64,name:63,description:1024}))assert.equal(schema.resourceFields[name].maxLength,limit,type+'.'+name+' bound mismatch');
        assert.equal(schema.resourceFields.name.minLength,1);assert.equal(schema.resourceFields.name.validChars,'a-zA-Z0-9-');
      }
    }
    for(const [name,field] of Object.entries(schema.resourceFields))if(!inputs.includes(name)){
      assert.equal(field.create,false,type+'.'+name+' must not be model input');assert.equal(field.update,false,type+'.'+name+' must not be client-updatable');
    }
  }
  for(const role of ['admin','user','project']){
    const {authorize}=await read(role+'/'+role+'-auth.json');
    assert.ok(authorize[type]?.includes(actionInput||auditSource?'r':'c'),role+' does not expose '+type);
    if(audit)assert.equal(authorize[type],auditSource?'r':'cr',role+' must retain the exact '+type+' route metadata');
    if(catalogLaunch)assert.ok(authorize[type]?.includes('r'),role+' cannot retain '+type+' metadata');
    if(type==='aiResourceView'){
      assert.equal(authorize[type+'.tailLines'],'cr',role+' must retain exact bounded logs input metadata');
      assert.equal(authorize[type+'.logs'],'r',role+' must retain read-only container logs output');
    }
    if(type==='aiServiceUpgradePlan'){
      assert.equal(authorize[type+'.upgradeStrategy'],'r',role+' must retain read-only effective upgrade strategy');
      assert.equal(authorize[type+'.configurationChanges'],'r',role+' must retain read-only configuration review');
    }
    for(const [name,field] of Object.entries(schema.resourceFields)){
      if(field.create){
        assert.ok(authorize[type+'.'+name]?.includes('c'),role+' cannot accept '+type+'.'+name);
        if(audit)assert.equal(authorize[type+'.'+name],'cr',role+' must retain exact Audit input metadata '+type+'.'+name);
        if(catalogLaunch)assert.ok(authorize[type+'.'+name]?.includes('r'),role+' cannot retain input metadata '+type+'.'+name);
      }
      else if(catalogLaunch)assert.ok(authorize[type+'.'+name]?.includes('r'),role+' cannot read safe '+type+'.'+name);
      if(audit&&!field.create)assert.equal(authorize[type+'.'+name],'r',role+' must retain read-only Audit output '+type+'.'+name);
    }
  }
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(![2,3].includes(args.length)||args[0]!=='--engine-root'||args.length===3&&!['--catalog-options-only','--external-tcp-only','--container-network-only'].includes(args[2]))
    throw Error('Usage: node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine [--catalog-options-only|--external-tcp-only|--container-network-only]');
  try {
    await checkEngineContract(args[1],{catalogOptionsOnly:args[2]==='--catalog-options-only',externalTcpOnly:args[2]==='--external-tcp-only',containerNetworkOnly:args[2]==='--container-network-only'});
    console.log(args[2]==='--container-network-only'?'PASS native child PUT/role/UUID envelope and legacy header compatibility source contract':args[2]==='--external-tcp-only'?'PASS External TCP/HTTP create/read native schema and closed typed-subset contract':
      args[2]==='--catalog-options-only'?'PASS Catalog options readonly schema and three-role contract':'PASS tool wire audit enum and effective role-overlay input contracts');
  } catch {
    console.error('WebMCP Engine contract check failed');
    process.exitCode=1;
  }
}
