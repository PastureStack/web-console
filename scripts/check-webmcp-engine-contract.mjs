import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMMANDS,PUBLIC_ERROR_CODES} from '../bridge/shared-modules.mjs';

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

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
export async function checkEngineContract(engineRoot, {catalogOptionsOnly = false, externalTcpOnly = false} = {}) {
const engine=path.resolve(engineRoot);
const schemaRoot=await containedSourcePath(engine,'resources/content/schema','Schema root escapes selected Engine');
const read=async relative=>JSON.parse(await readContainedSource(schemaRoot,relative,'Schema file escapes selected Engine'));
if(externalTcpOnly){
  const external=await read('base/externalService.json'),user=await read('user/user-auth.json');
  assert.equal(external.resourceFields.healthCheck.type,'instanceHealthCheck','External health check must retain its native type');
  assert.equal(user.authorize['externalService.healthCheck'],'cr','External health check is native create/read, never update');
  const tool=COMMANDS.find(item=>item.name==='preview_resource_change');
  const condition=tool.inputSchema.allOf.find(item=>item.if.properties.resourceType.const==='externalService');
  const check=condition.then.properties.parameters.properties.healthCheck;
  assert.equal(condition.then.properties.operation.const,'create');assert.equal(check.additionalProperties,false);
  assert.deepEqual(check.required,['port']);
  assert.deepEqual(Object.keys(check.properties).sort(),['port','interval','responseTimeout','healthyThreshold','unhealthyThreshold'].sort());
  const model=await readContainedSource(engine,'code/iaas/model/src/main/java/io/cattle/platform/core/addon/InstanceHealthCheck.java',
    'Native health model escapes selected Engine');
  assert.match(model,/@Field\(required = true, min = 1, max = 65535\)\s+public Integer getPort\(\)/);
  assert.equal(check.properties.port.minimum,1);assert.equal(check.properties.port.maximum,65535);
  for(const name of ['interval','responseTimeout','healthyThreshold','unhealthyThreshold']){
    assert.match(model,new RegExp('Integer '+name+';'),'Native '+name+' must retain Integer precision');
    // A positive typed subset; native Integer metadata supplies no timing default.
    assert.equal(check.properties[name].type,'integer');assert.equal(check.properties[name].minimum,1);
    assert.equal(check.properties[name].maximum,2147483647);assert.equal(Object.hasOwn(check.properties[name],'default'),false);
  }
  return;
}
if(!catalogOptionsOnly){
  const event=await read('base/aiToolCallEvent.json');
  assert.deepEqual([...event.resourceFields.command.options].sort(),[...COMMANDS.map(t=>t.name),'unknown'].sort(),'Tool audit wire enum does not match the frontend');
  for(const code of [...PUBLIC_ERROR_CODES,'NONE'])assert.ok(event.resourceFields.reason.options.includes(code),'Public error '+code+' cannot be audited');
}
const wireInputs={aiServiceUpgradePlan:['serviceId','image','startFirst','batchSize','intervalMillis'],aiServiceDescriptionUpdate:['serviceId','description','expectedDescription'],
  aiToolCallEvent:['command','phase','status','reason','correlationId'],aiResourceView:['resourceType','resourceId','query','marker','parentId'],
  aiResourceChangePlan:['resourceType','operation','resourceId','parameters'],aiCatalogMetadataView:['query','marker','templateId','versions','versionId'],
  aiCatalogStackLaunchOptions:['templateId','versionId'],
  aiCatalogStackLaunchPlan:['templateId','versionId','optionsRef','name','description','startOnCreate','answers','referenceBindings'],
  aiCatalogStackLaunchInputs:['answers','referenceBindings'],
  aiAuditQuery:['keyId','environmentId','from','to','lastMinutes','decision','outcome','operation','targetType','requestId','httpStatus','limit','offset','eventId'],
  aiAuditSourcePageInput:['limit','marker','projectId','accountId','from','to','keyKind']};
for(const [type,inputs] of Object.entries(wireInputs)){
  if(catalogOptionsOnly&&type!=='aiCatalogStackLaunchOptions')continue;
  const schema=await read('base/'+type+'.json');
  const actionInput=type==='aiCatalogStackLaunchInputs';
  const auditQuery=type==='aiAuditQuery',auditSource=type==='aiAuditSourcePageInput',audit=auditQuery||auditSource;
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
    assert.equal(schema.resourceFields.upgradeStrategy?.type,'json',type+' must return effective strategy');
    assert.equal(schema.resourceFields.upgradeStrategy.create,false,type+'.upgradeStrategy must be read-only output');
    assert.equal(schema.resourceFields.upgradeStrategy.update,false,type+'.upgradeStrategy must not be client-updatable');
  }
  if(type==='aiResourceChangePlan'){
    const properties=COMMANDS.find(tool=>tool.name==='preview_resource_change').inputSchema.properties;
    // Catalog launch has its own closed collection and input contract; it must
    // never be silently admitted by the ordinary lifecycle plan endpoint.
    for(const name of ['resourceType','operation'])assert.deepEqual([...schema.resourceFields[name].options].sort(),
      properties[name].enum.filter(value=>name!=='operation'||value!=='create_from_catalog').sort(),'Typed change '+name+' enum mismatch');
    assert.equal(schema.resourceFields.parameters.type,'json','Typed parameters must preserve JSON values');
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
      const field=schema.resourceFields[name],kind=auditSource?(name==='limit'?'int':name==='keyKind'?'enum':'string'):['lastMinutes','httpStatus','limit','offset'].includes(name)?'int':'string';
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
    if(type==='aiServiceUpgradePlan')assert.equal(authorize[type+'.upgradeStrategy'],'r',role+' must retain read-only effective upgrade strategy');
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
  if(![2,3].includes(args.length)||args[0]!=='--engine-root'||args.length===3&&!['--catalog-options-only','--external-tcp-only'].includes(args[2]))
    throw Error('Usage: node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine [--catalog-options-only|--external-tcp-only]');
  try {
    await checkEngineContract(args[1],{catalogOptionsOnly:args[2]==='--catalog-options-only',externalTcpOnly:args[2]==='--external-tcp-only'});
    console.log(args[2]==='--external-tcp-only'?'PASS External TCP create/read native schema and closed typed-subset contract':
      args[2]==='--catalog-options-only'?'PASS Catalog options readonly schema and three-role contract':'PASS tool wire audit enum and effective role-overlay input contracts');
  } catch {
    console.error('WebMCP Engine contract check failed');
    process.exitCode=1;
  }
}
