import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMMANDS,PUBLIC_ERROR_CODES} from '../bridge/shared-modules.mjs';

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
export async function checkEngineContract(engineRoot) {
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
const event=await read('base/aiToolCallEvent.json');
assert.deepEqual([...event.resourceFields.command.options].sort(),[...COMMANDS.map(t=>t.name),'unknown'].sort(),'Tool audit wire enum does not match the frontend');
for(const code of [...PUBLIC_ERROR_CODES,'NONE'])assert.ok(event.resourceFields.reason.options.includes(code),'Public error '+code+' cannot be audited');
const wireInputs={aiServiceUpgradePlan:['serviceId','image'],aiServiceDescriptionUpdate:['serviceId','description','expectedDescription'],
  aiToolCallEvent:['command','phase','status','reason','correlationId'],aiResourceView:['resourceType','resourceId','query','marker','parentId'],
  aiResourceChangePlan:['resourceType','operation','resourceId','parameters']};
for(const [type,inputs] of Object.entries(wireInputs)){
  const schema=await read('base/'+type+'.json');
  assert.ok(schema.collectionMethods.includes('POST'),type+' is not a POST input contract');
  for(const name of inputs)assert.equal(schema.resourceFields[name]?.create,true,type+'.'+name+' is not accepted input');
  if(type==='aiResourceChangePlan'){
    const properties=COMMANDS.find(tool=>tool.name==='preview_resource_change').inputSchema.properties;
    for(const name of ['resourceType','operation'])assert.deepEqual([...schema.resourceFields[name].options].sort(),[...properties[name].enum].sort(),'Typed change '+name+' enum mismatch');
    assert.equal(schema.resourceFields.parameters.type,'json','Typed parameters must preserve JSON values');
  }
  for(const role of ['admin','user','project']){
    const {authorize}=await read(role+'/'+role+'-auth.json');
    assert.ok(authorize[type]?.includes('c'),role+' does not expose '+type);
    for(const [name,field] of Object.entries(schema.resourceFields)){
      if(field.create)assert.ok(authorize[type+'.'+name]?.includes('c'),role+' cannot accept '+type+'.'+name);
    }
  }
}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=='--engine-root')throw Error('Usage: node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine');
  try {
    await checkEngineContract(args[1]);
    console.log('PASS tool wire audit enum and effective role-overlay input contracts');
  } catch {
    console.error('WebMCP Engine contract check failed');
    process.exitCode=1;
  }
}
