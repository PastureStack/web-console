import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,statfs} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Only the newly added logs contract is varied. Existing path-boundary controls
// and the unrelated suites are not replayed. No checker assertion is bypassed.
const flags=new Map();
for(let i=2;i<process.argv.length;i+=2){
  assert.ok(['--engine-root','--web-root','--checker','--work-root','--output'].includes(process.argv[i]));
  assert.ok(process.argv[i+1]&&!flags.has(process.argv[i]));flags.set(process.argv[i],process.argv[i+1]);
}
assert.ok(flags.has('--engine-root'),'--engine-root must select the actual Engine source checkout');
const web=path.resolve(flags.get('--web-root')||fileURLToPath(new URL('../..',import.meta.url)));
const engine=path.resolve(flags.get('--engine-root'));
const checker=path.resolve(flags.get('--checker')||path.join(web,'scripts/check-webmcp-engine-contract.mjs'));
const work=path.resolve(flags.get('--work-root')||os.tmpdir());
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const floor=8*1024**3;
async function reserve(bytes=0){const fs=await statfs(work);assert.ok(fs.bavail*fs.bsize>=floor+bytes,'Original eight-GiB source-fixture floor');}
await reserve();
const raw=await readFile(checker,'utf8'),shared=pathToFileURL(path.join(web,'bridge/shared-modules.mjs')).href;
assert.equal(raw.split("'../bridge/shared-modules.mjs'").length,2,'One unchanged shared-source import');
const cli=raw.indexOf('\nif(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))');
assert.ok(cli>0,'Keep the normal checker CLI intact; omit only its auto-entry in this in-memory import');
const module=raw.slice(0,cli).replace("'../bridge/shared-modules.mjs'",JSON.stringify(shared));
const {checkEngineContract}=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
const {COMMANDS}=await import(shared);
const cases=[];
await checkEngineContract(engine);
cases.push({name:'actual-Engine384-source-normal-checkEngineContract',status:'PASS'});

const fixture=await mkdtemp(path.join(work,'engine384-container-logs-'));
assert.ok(fixture.startsWith(work+path.sep)&&fixture!==engine&&fixture!==web);
const wire=raw.match(/const wireInputs=\{([\s\S]*?)\};/);assert.ok(wire);
const names=[...wire[1].matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9]*)\s*:/g)].map(m=>m[1]);
assert.ok(names.includes('aiResourceView')&&names.length>1);
const originals=new Map();let bytes=0;
for(const relative of [...names.map(name=>'base/'+name+'.json'),...['admin','user','project'].map(role=>role+'/'+role+'-auth.json')]){
  const data=await readFile(path.join(engine,'resources/content/schema',relative));bytes+=data.length;
  assert.ok(bytes<768*1024,'Bounded source-schema fixture, no dependency or artifact copies');await reserve(data.length);
  const target=path.join(fixture,'resources/content/schema',relative);await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,data,{flag:'wx'});originals.set(relative,data);
}
await checkEngineContract(fixture);
cases.push({name:'exact-source-schema-fixture-normal-checkEngineContract',status:'PASS'});
async function rejected(name){
  await assert.rejects(()=>checkEngineContract(fixture),error=>error?.code==='ERR_ASSERTION',name+' must fail a contract assertion');
  cases.push({name,status:'REJECTED_AS_REQUIRED'});
}
async function schemaCase(name,relative,change){
  const original=originals.get(relative);assert.ok(original);
  const value=JSON.parse(original);change(value);
  const target=path.join(fixture,'resources/content/schema',relative);
  try{await writeFile(target,JSON.stringify(value));await rejected(name);}
  finally{await writeFile(target,original);}
}
const view='base/aiResourceView.json';
for(const [name,change] of [
  ['tailLines-max-201',s=>s.resourceFields.tailLines.max=201],
  ['tailLines-min-zero',s=>s.resourceFields.tailLines.min=0],
  ['tailLines-noninteger-type',s=>s.resourceFields.tailLines.type='long'],
  ['tailLines-not-create-input',s=>s.resourceFields.tailLines.create=false],
  ['tailLines-client-updatable',s=>s.resourceFields.tailLines.update=true],
  ['view-missing-container_logs',s=>s.resourceFields.view.options=['stack_graph']],
  ['view-missing-original-stack_graph',s=>s.resourceFields.view.options=['container_logs']],
  ['logs-not-map-json',s=>s.resourceFields.logs.type='json'],
  ['logs-client-create-input',s=>s.resourceFields.logs.create=true],
  ['logs-client-updatable',s=>s.resourceFields.logs.update=true],
  ['logs-read-on-create-only',s=>s.resourceFields.logs.readOnCreateOnly=true],
])await schemaCase(name,view,change);
for(const role of ['admin','user','project']){
  await schemaCase(role+'-logs-write-grant',role+'/'+role+'-auth.json',s=>s.authorize['aiResourceView.logs']='cr');
  await schemaCase(role+'-tailLines-update-grant',role+'/'+role+'-auth.json',s=>s.authorize['aiResourceView.tailLines']='cru');
}
const tool=COMMANDS.find(t=>t.name==='get_resource');assert.ok(tool);
const originalTool=tool.inputSchema;
for(const [name,change] of [
  ['tool-tailLines-max-201',s=>s.properties.tailLines.maximum=201],
  ['tool-tailLines-noninteger-type',s=>s.properties.tailLines.type='number'],
  ['tool-extra-follow-property',s=>s.properties.follow={type:'boolean'}],
  ['tool-additional-properties-open',s=>s.additionalProperties=true],
]){
  try{tool.inputSchema=structuredClone(originalTool);change(tool.inputSchema);await rejected(name);}
  finally{tool.inputSchema=originalTool;}
}
assert.equal(tool.inputSchema,originalTool);
for(const [relative,original] of originals)assert.deepEqual(await readFile(path.join(fixture,'resources/content/schema',relative)),original);
const result={status:'PASS_DIRECT_CONTAINER_LOGS_CHECKER_SOURCE_REGRESSION',checker:{path:checker,sha256:hash(raw)},
  actualEngineSource:{root:engine,aiResourceViewSha256:hash(await readFile(path.join(engine,'resources/content/schema',view)))},
  schemaFixture:fixture,fixtureBytes:bytes,passedPositive:2,rejectedNegative:cases.length-2,cases,
  oldPathBoundaryTestsRepeated:false,rootSourcesModified:false,artifactOrPublishedEngineClaimed:false,networkCalls:0,nativeCalls:0};
if(flags.has('--output'))await writeFile(path.resolve(flags.get('--output')),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
