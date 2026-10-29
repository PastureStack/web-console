import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Release-assembly check for two explicitly selected source checkouts.
// No network requests, credentials, generated copies or source modification.
const args=process.argv.slice(2);
if(args.length!==2 || args[0]!=='--engine-root')throw Error('Usage: node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine');
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const engine=path.resolve(args[1]);
const read=async relative=>JSON.parse(await readFile(path.join(engine,'resources/content/schema',relative),'utf8'));
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
console.log('PASS seven-tool wire audit enum and all three effective role-overlay input contracts');
