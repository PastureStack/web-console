import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMMANDS,PUBLIC_ERROR_CODES} from '../bridge/shared-modules.mjs';

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
export async function checkEngineContract(engineRoot, {catalogOptionsOnly = false} = {}) {
const engine=path.resolve(engineRoot);
const requestedSchema=path.resolve(engine,'resources/content/schema');
const requestedRelative=path.relative(engine,requestedSchema);
if(requestedRelative==='..'||requestedRelative.startsWith('..'+path.sep)||path.isAbsolute(requestedRelative))throw Error('Schema root escapes selected Engine');
const schemaRoot=await realpath(requestedSchema);
const schemaRelative=path.relative(engine,schemaRoot);
if(schemaRelative==='..'||schemaRelative.startsWith('..'+path.sep)||path.isAbsolute(schemaRelative))throw Error('Schema root escapes selected Engine');
const read=async relative=>{
  const target=await realpath(path.resolve(schemaRoot,relative));
  const inside=path.relative(schemaRoot,target);
  if(inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside))throw Error('Schema file escapes selected Engine');
  return JSON.parse(await readFile(target,'utf8'));
};
if(!catalogOptionsOnly){
  const event=await read('base/aiToolCallEvent.json');
  assert.deepEqual([...event.resourceFields.command.options].sort(),[...COMMANDS.map(t=>t.name),'unknown'].sort(),'Tool audit wire enum does not match the frontend');
  for(const code of [...PUBLIC_ERROR_CODES,'NONE'])assert.ok(event.resourceFields.reason.options.includes(code),'Public error '+code+' cannot be audited');
}
const wireInputs={aiServiceUpgradePlan:['serviceId','image'],aiServiceDescriptionUpdate:['serviceId','description','expectedDescription'],
  aiToolCallEvent:['command','phase','status','reason','correlationId'],aiResourceView:['resourceType','resourceId','query','marker','parentId'],
  aiResourceChangePlan:['resourceType','operation','resourceId','parameters'],aiCatalogMetadataView:['query','marker','templateId','versions','versionId'],
  aiCatalogStackLaunchOptions:['templateId','versionId'],
  aiCatalogStackLaunchPlan:['templateId','versionId','optionsRef','name','description','startOnCreate','answers','referenceBindings'],
  aiCatalogStackLaunchInputs:['answers','referenceBindings']};
for(const [type,inputs] of Object.entries(wireInputs)){
  if(catalogOptionsOnly&&type!=='aiCatalogStackLaunchOptions')continue;
  const schema=await read('base/'+type+'.json');
  const actionInput=type==='aiCatalogStackLaunchInputs';
  if(actionInput){assert.deepEqual(schema.collectionMethods,[],'Human input must not have its own collection route');assert.deepEqual(schema.resourceMethods,[],'Human input must not have its own resource route');}
  else assert.ok(schema.collectionMethods.includes('POST'),type+' is not a POST input contract');
  for(const name of inputs)assert.equal(schema.resourceFields[name]?.create,true,type+'.'+name+' is not accepted input');
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
    assert.ok(authorize[type]?.includes(actionInput?'r':'c'),role+' does not expose '+type);
    if(catalogLaunch)assert.ok(authorize[type]?.includes('r'),role+' cannot retain '+type+' metadata');
    for(const [name,field] of Object.entries(schema.resourceFields)){
      if(field.create){
        assert.ok(authorize[type+'.'+name]?.includes('c'),role+' cannot accept '+type+'.'+name);
        if(catalogLaunch)assert.ok(authorize[type+'.'+name]?.includes('r'),role+' cannot retain input metadata '+type+'.'+name);
      }
      else if(catalogLaunch)assert.ok(authorize[type+'.'+name]?.includes('r'),role+' cannot read safe '+type+'.'+name);
    }
  }
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(![2,3].includes(args.length)||args[0]!=='--engine-root'||args.length===3&&args[2]!=='--catalog-options-only')
    throw Error('Usage: node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine [--catalog-options-only]');
  try {
    await checkEngineContract(args[1],{catalogOptionsOnly:args.length===3});
    console.log(args.length===3?'PASS Catalog options readonly schema and three-role contract':'PASS tool wire audit enum and effective role-overlay input contracts');
  } catch {
    console.error('WebMCP Engine contract check failed');
    process.exitCode=1;
  }
}
