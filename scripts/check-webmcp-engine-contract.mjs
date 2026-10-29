import assert from 'node:assert/strict';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function checkEngineContract(engineRoot) {
const engine=await realpath(path.resolve(engineRoot));
const schemaRoot=await realpath(path.join(engine,'resources/content/schema'));
const schemaRelative=path.relative(engine,schemaRoot);
if(schemaRelative==='..'||schemaRelative.startsWith('..'+path.sep)||path.isAbsolute(schemaRelative))throw Error('Schema root escapes selected Engine');
const read=async relative=>{
  const target=await realpath(path.resolve(schemaRoot,relative));
  const inside=path.relative(schemaRoot,target);
  if(inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside))throw Error('Schema file escapes selected Engine');
  return JSON.parse(await readFile(target,'utf8'));
};
const source=await readFile(path.join(web,'app/utils/ai-command-contract.js'),'utf8');
const {COMMANDS}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const event=await read('base/aiToolCallEvent.json');
assert.deepEqual([...event.resourceFields.command.options].sort(),[...COMMANDS.map(t=>t.name),'unknown'].sort(),'Tool audit wire enum does not match the frontend');
for(const type of ['aiServiceUpgradePlan','aiServiceDescriptionUpdate','aiToolCallEvent']){
  const schema=await read('base/'+type+'.json');
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
    console.log('PASS seven-tool wire audit enum and all three effective role-overlay input contracts');
  } catch {
    console.error('WebMCP Engine contract check failed');
    process.exitCode=1;
  }
}
