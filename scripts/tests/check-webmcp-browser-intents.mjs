import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

process.on('uncaughtException',error=>{console.error(String(error.stack||error).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[loaded source]'));process.exitCode=1;});

const flags=new Map();
for(let i=2;i<process.argv.length;i+=2){
  assert.ok(['--web-root','--engine-schema','--output'].includes(process.argv[i]));
  assert.ok(process.argv[i+1]&&!flags.has(process.argv[i]));flags.set(process.argv[i],process.argv[i+1]);
}
const web=path.resolve(flags.get('--web-root')||fileURLToPath(new URL('../..',import.meta.url)));
assert.ok(flags.has('--engine-schema'),'Read the actual selected Engine lifecycle schema');
const registrySource=await readFile(path.join(web,'app/utils/ai-resource-registry.js'),'utf8');
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const registryUrl=url(registrySource), registry=await import(registryUrl);
const contractSource=await readFile(path.join(web,'app/utils/ai-command-contract.js'),'utf8');
const contractUrl=url(contractSource.replace("'./ai-resource-registry'",JSON.stringify(registryUrl)));
const contract=await import(contractUrl);
// Same immutable exports as the ordinary shared loader; only its filesystem
// resolution and the checker's CLI auto-entry are omitted for this pure gate test.
const shared=url(`export {COMMANDS,PUBLIC_ERROR_CODES} from ${JSON.stringify(contractUrl)};
export {RESOURCE_CHANGES,NATIVE_CHANGE_OPERATIONS,BROWSER_LOCAL_INTENTS} from ${JSON.stringify(registryUrl)};`);
const checker=await readFile(path.join(web,'scripts/check-webmcp-engine-contract.mjs'),'utf8');
assert.equal(checker.split("'../bridge/shared-modules.mjs'").length,2);
const cli=checker.indexOf('\nif(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))');assert.ok(cli>0);
const {checkResourceChangeIntentContract: check}=await import(url(checker.slice(0,cli).replace("'../bridge/shared-modules.mjs'",JSON.stringify(shared))));
const engine=JSON.parse(await readFile(flags.get('--engine-schema'),'utf8'));
const nativeOptions=engine.resourceFields.operation.options;
const baseline=check(nativeOptions);
assert.equal(contract.COMMANDS.length,12);
const cases=[{name:'actual-Engine-operation-enum-with-closed-public-intent-descriptors',status:'PASS'}];
function fixture(){return structuredClone({commands:contract.COMMANDS,resourceChanges:registry.RESOURCE_CHANGES,
  nativeOperations:registry.NATIVE_CHANGE_OPERATIONS,localIntents:registry.BROWSER_LOCAL_INTENTS,nativeOptions});}
function reindex(f){
  const entries=Object.entries(f.resourceChanges).flatMap(([resourceType,operations])=>Object.entries(operations).map(([operation,d])=>({resourceType,operation,...d})));
  f.nativeOperations=[...new Set(entries.filter(row=>row.execution==='native-wire'&&row.wire==='aiResourceChangePlans').map(row=>row.operation))];
  f.localIntents=entries.filter(row=>row.execution==='browser-human-confirmation').sort((a,b)=>a.operation.localeCompare(b.operation));
  f.commands.find(row=>row.name==='preview_resource_change').inputSchema.properties.operation.enum=[...new Set(entries.map(row=>row.operation))];
}
const preview=f=>f.commands.find(row=>row.name==='preview_resource_change').inputSchema;
const condition=f=>preview(f).allOf.find(row=>Array.isArray(row.if?.properties?.operation?.enum));
function reject(name,mutate,index=true){
  const f=fixture();mutate(f);if(index)reindex(f);
  assert.throws(()=>check(f.nativeOptions,f),error=>error?.code==='ERR_ASSERTION',name+' must fail the unchanged gate');
  cases.push({name,status:'REJECTED_AS_REQUIRED'});
}
reject('unknown-Engine-native-operation',f=>f.nativeOptions.push('unknown_native'),false);
reject('missing-Engine-native-operation',f=>f.nativeOptions.pop(),false);
reject('undeclared-public-operation',f=>preview(f).properties.operation.enum.push('unknown_public'),false);
reject('unknown-native-descriptor-with-synchronized-index',f=>f.resourceChanges.project.unknown_native={...f.resourceChanges.project.update_metadata});
reject('unknown-execution-owner',f=>f.resourceChanges.service.start.execution='unknown-owner');
reject('unknown-native-wire-owner',f=>f.resourceChanges.service.start.wire='unknownEndpoint');
reject('native-stop-hidden-as-Catalog',f=>f.resourceChanges.service.stop.wire='aiCatalogStackLaunchPlans');
reject('unknown-local-descriptor-with-synchronized-index',f=>f.resourceChanges.project.unknown_local={...f.resourceChanges.project.set_default});
reject('local-intent-on-wrong-resource',f=>{f.resourceChanges.service.set_default=f.resourceChanges.project.set_default;delete f.resourceChanges.project.set_default;});
reject('local-with-native-wire',f=>f.resourceChanges.project.set_default.wire='aiResourceChangePlans');
reject('local-misdeclared-as-native',f=>Object.assign(f.resourceChanges.project.set_default,{execution:'native-wire',wire:'aiResourceChangePlans'}));
reject('known-native-misdeclared-as-local',f=>f.resourceChanges.project.update_metadata={...f.resourceChanges.project.set_default});
reject('local-nonempty-parameters',f=>Object.assign(f.resourceChanges.project.set_default,{fields:['name'],required:['name'],minFields:1}));
reject('local-native-effect-proof',f=>f.resourceChanges.project.set_default.effectScope='native-operation');
reject('local-model-write-enabled',f=>f.resourceChanges.project.set_default.modelApply='execute');
reject('local-stdio-transport',f=>f.resourceChanges.project.set_default.transport='stdio');
reject('local-Bridge-auto-rebind',f=>f.resourceChanges.project.set_default.bridge='automatic-rebind');
reject('native-index-drops-an-operation',f=>f.nativeOperations.pop(),false);
reject('local-index-drops-an-intent',f=>f.localIntents.pop(),false);
reject('local-schema-wrong-resource',f=>condition(f).then.properties.resourceType.const='service',false);
reject('local-schema-open-parameters',f=>condition(f).then.properties.parameters.additionalProperties=true,false);
reject('local-schema-raw-selection',f=>condition(f).then.required=[],false);
reject('local-schema-allows-parent',f=>delete condition(f).then.not,false);
reject('local-schema-condition-removed',f=>preview(f).allOf=preview(f).allOf.filter(row=>row!==condition(f)),false);
for(const operation of ['switch_context','set_default']){
  contract.validateInput('preview_resource_change',{resourceType:'project',operation,targetRef:'resource_selected',parameters:{}});
  for(const change of [{resourceType:'service'},{parameters:{name:'wrong'}},{parentRef:'resource_parent'},{catalogVersionRef:'resource_catalog'},{targetRef:undefined}]){
    const input={resourceType:'project',operation,targetRef:'resource_selected',parameters:{},...change};
    if(change.targetRef===undefined&&Object.hasOwn(change,'targetRef'))delete input.targetRef;
    assert.throws(()=>contract.validateInput('preview_resource_change',input),error=>error.code==='INVALID_INPUT');
  }
}
cases.push({name:'local-public-validator-project-empty-parameters-opaque-target-envelope',status:'PASS'});
const report={status:'PURE_OPERATION_GATE_PASS_NOT_FULL_CROSS_REPO',nativeOperations:baseline.nativeOperations,
  nativeCount:baseline.nativeOperations.length,browserLocalCount:baseline.localIntents.length,publicCount:baseline.publicOperations.length,cases};
if(flags.has('--output'))await writeFile(flags.get('--output'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(`BROWSER_INTENT_CONTRACT_PASS=${cases.length}; native=${report.nativeCount}; browser=${report.browserLocalCount}; public=${report.publicCount}`);
