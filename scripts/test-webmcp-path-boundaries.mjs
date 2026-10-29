import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadConfig} from '../bridge/core.mjs';
import {COMMANDS,PUBLIC_ERROR_CODES} from '../bridge/shared-modules.mjs';
import {checkEngineContract} from './check-webmcp-engine-contract.mjs';

const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config={endpoint:'https://example.test',environment:'Selected',accessKey:'fixture-access',secretKey:'fixture-secret'};
async function temp(t){
  const parent=await fs.realpath(tmpdir()),dir=await fs.mkdtemp(path.join(parent,'webmcp-path-'));
  t.after(async()=>{assert.equal(path.dirname(dir),parent);assert.ok(path.basename(dir).startsWith('webmcp-path-'));await fs.rm(dir,{recursive:true,force:true});});
  return dir;
}
const safeError=code=>error=>error.code===code&&error.message===code;

test('config accepts explicitly selected arbitrary directories and relative paths',async t=>{
  const dir=await temp(t),nested=path.join(dir,'自訂 custom directory');await fs.mkdir(nested);
  const file=path.join(nested,'chosen.config');await fs.writeFile(file,JSON.stringify(config));
  assert.deepEqual(await loadConfig(file),config);
  assert.deepEqual(await loadConfig(path.relative(process.cwd(),file)),config);
  await fs.writeFile(file,'not json');await assert.rejects(loadConfig(file),safeError('CONFIG_UNREADABLE'));
});

test('config rejects canonical escape, directories and oversized files before opening',async t=>{
  const dir=await temp(t),file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(config));
  let opened=0;const io={...fs,open:async()=>{opened++;throw Error('must not open');}};
  await assert.rejects(loadConfig(dir,io),safeError('INVALID_CONFIG'));
  await fs.writeFile(file,'x'.repeat(16385));await assert.rejects(loadConfig(file,io),safeError('INVALID_CONFIG'));
  await assert.rejects(loadConfig(file,{...io,realpath:async candidate=>candidate===file?path.join(path.dirname(dir),'outside.json'):fs.realpath(candidate)}),safeError('CONFIG_UNREADABLE'));
  assert.equal(opened,0);
});

test('config rejects replacement before open and bounds a concurrent growth read',async t=>{
  const dir=await temp(t),file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(loadConfig(file,{...fs,open:async(p,flags)=>{
    await fs.rename(file,path.join(dir,'old.json'));await fs.writeFile(file,JSON.stringify(config));return fs.open(p,flags);
  }}),safeError('CONFIG_UNREADABLE'));
  let requested=0,grown=false;
  await assert.rejects(loadConfig(file,{...fs,open:async(p,flags)=>{
    const handle=await fs.open(p,flags);
    return {stat:()=>handle.stat(),close:()=>handle.close(),read:async(buffer,offset,length,position)=>{
      requested+=length;if(!grown){grown=true;await fs.appendFile(file,'x'.repeat(32768));}
      return handle.read(buffer,offset,length,position);
    }};
  }}),safeError('INVALID_CONFIG'));
  assert.ok(requested<=16385,'read stays bounded after the file grows');
});

async function fixture(dir){
  const schema=path.join(dir,'resources/content/schema');
  const names=['aiServiceUpgradePlan','aiServiceDescriptionUpdate','aiToolCallEvent','aiResourceView','aiResourceChangePlan','aiCatalogMetadataView',
    'aiCatalogStackLaunchOptions','aiCatalogStackLaunchPlan','aiCatalogStackLaunchInputs'];
  const inputs={aiServiceUpgradePlan:['serviceId','image'],aiServiceDescriptionUpdate:['serviceId','description','expectedDescription'],
    aiToolCallEvent:['command','phase','status','reason','correlationId'],aiResourceView:['resourceType','resourceId','query','marker','parentId'],
    aiResourceChangePlan:['resourceType','operation','resourceId','parameters'],aiCatalogMetadataView:['query','marker','templateId','versions','versionId'],
    aiCatalogStackLaunchOptions:['templateId','versionId'],
    aiCatalogStackLaunchPlan:['templateId','versionId','optionsRef','name','description','startOnCreate','answers','referenceBindings'],
    aiCatalogStackLaunchInputs:['answers','referenceBindings']};
  const declarations=new Map();
  for(const part of ['base','admin','user','project'])await fs.mkdir(path.join(schema,part),{recursive:true});
  for(const name of names){
    const fields=Object.fromEntries(inputs[name].map(field=>[field,{create:true}]));
    if(name==='aiToolCallEvent'){fields.command.options=[...COMMANDS.map(x=>x.name),'unknown'];fields.reason.options=[...PUBLIC_ERROR_CODES,'NONE'];}
    if(name==='aiResourceChangePlan'){
      fields.resourceType.options=['stack','service','container'];fields.operation.options=['start','stop','restart','remove','create','update_metadata','scale','archive','restore'];fields.parameters.type='json';
    }
    if(name==='aiCatalogMetadataView'){
      for(const [field,limit] of Object.entries({query:256,marker:128,templateId:68,versionId:68}))Object.assign(fields[field],{type:'string',maxLength:limit});
      fields.versions.type='boolean';
    }
    const declaration={collectionMethods:['POST'],resourceMethods:[],resourceFields:fields};
    if(name.startsWith('aiCatalogStackLaunch')){
      for(const key of ['templateId','versionId'])if(fields[key])Object.assign(fields[key],{type:'string',required:true,maxLength:68});
      if(fields.answers)fields.answers.type='map[json]';if(fields.referenceBindings)fields.referenceBindings.type='map[string]';
      if(name==='aiCatalogStackLaunchInputs')declaration.collectionMethods=[];
      else if(name==='aiCatalogStackLaunchOptions'){
        declaration.pluralName=name;
        for(const [key,type] of Object.entries({questions:'array[json]',optionsRef:'string',launchEnabled:'boolean',requiredOperations:'array[string]',resourceTextIsUntrusted:'boolean'}))fields[key]={type,create:false,update:false};
      }else{
        declaration.pluralName='aiCatalogStackLaunchPlans';declaration.collectionMethods=['GET','POST'];declaration.resourceMethods=['GET'];
        declaration.resourceActions={completeInputs:{input:'aiCatalogStackLaunchInputs',output:'aiCatalogStackLaunchPlan'},confirm:{},apply:{},cancel:{}};
        Object.assign(fields.optionsRef,{type:'string',required:true,maxLength:64});Object.assign(fields.name,{type:'string',required:true,minLength:1,maxLength:63,validChars:'a-zA-Z0-9-'});
        Object.assign(fields.description,{type:'string',maxLength:1024});Object.assign(fields.startOnCreate,{type:'boolean',required:true});
        for(const [key,type] of Object.entries({status:'string',reason:'string',verifiedResult:'boolean',requiresHumanConfirmation:'boolean',confirmationState:'string',inputsReady:'boolean',summary:'json',changes:'array[json]',missingHumanInputs:'array[json]',expiresAt:'date',createdResource:'json',resourceTextIsUntrusted:'boolean'}))fields[key]={type,create:false,update:false};
      }
    }
    declarations.set(name,declaration);
    await fs.writeFile(path.join(schema,'base',name+'.json'),JSON.stringify(declaration));
  }
  for(const role of ['admin','user','project'])await fs.writeFile(path.join(schema,role,role+'-auth.json'),JSON.stringify({authorize:Object.fromEntries(names.flatMap(name=>[
    [name,name==='aiCatalogStackLaunchInputs'?'r':name.startsWith('aiCatalogStackLaunch')?'cr':'c'],
    ...Object.entries(declarations.get(name).resourceFields).map(([field,value])=>[name+'.'+field,value.create?(name.startsWith('aiCatalogStackLaunch')?'cr':'c'):'r'])]))}));
  return schema;
}
test('checker reads the fixed contract in an explicitly selected Engine checkout',async t=>{
  const dir=await temp(t);await fixture(dir);await checkEngineContract(dir);
});

test('checker rejects omitted writable inputs and mismatched typed lifecycle enums',async t=>{
  const dir=await temp(t),schema=await fixture(dir),file=path.join(schema,'base/aiResourceChangePlan.json');
  const original=JSON.parse(await fs.readFile(file,'utf8'));
  const missing=structuredClone(original);missing.resourceFields.parameters.create=false;await fs.writeFile(file,JSON.stringify(missing));
  await assert.rejects(checkEngineContract(dir),/parameters is not accepted input/);
  const wrong=structuredClone(original);wrong.resourceFields.operation.options.push('execute');await fs.writeFile(file,JSON.stringify(wrong));
  await assert.rejects(checkEngineContract(dir),/operation enum mismatch/);
  const catalog=structuredClone(original);catalog.resourceFields.operation.options.push('create_from_catalog');await fs.writeFile(file,JSON.stringify(catalog));
  await assert.rejects(checkEngineContract(dir),/operation enum mismatch/);
});

test('checker rejects an Engine contract missing archive or restore from the typed operations',async t=>{
  const dir=await temp(t),schema=await fixture(dir),file=path.join(schema,'base/aiResourceChangePlan.json');
  const original=JSON.parse(await fs.readFile(file,'utf8'));
  for(const operation of ['archive','restore']){
    const value=structuredClone(original);value.resourceFields.operation.options=value.resourceFields.operation.options.filter(item=>item!==operation);
    await fs.writeFile(file,JSON.stringify(value));
    await assert.rejects(checkEngineContract(dir),/operation enum mismatch/);
  }
});

test('checker rejects a public capacity error missing from the durable audit enum',async t=>{
  const dir=await temp(t),schema=await fixture(dir),file=path.join(schema,'base/aiToolCallEvent.json');
  const event=JSON.parse(await fs.readFile(file,'utf8'));
  event.resourceFields.reason.options=event.resourceFields.reason.options.filter(code=>code!=='CAPACITY');
  await fs.writeFile(file,JSON.stringify(event));
  await assert.rejects(checkEngineContract(dir),/Public error CAPACITY cannot be audited/);
});

test('checker rejects missing Catalog version inputs and unbounded or wrongly typed selectors',async t=>{
  const dir=await temp(t),schema=await fixture(dir),file=path.join(schema,'base/aiCatalogMetadataView.json');
  const original=JSON.parse(await fs.readFile(file,'utf8'));
  for(const [change,pattern] of [
    [value=>{value.resourceFields.versionId.create=false;},/versionId is not accepted input/],
    [value=>{delete value.resourceFields.marker.maxLength;},/Catalog marker bound mismatch/],
    [value=>{value.resourceFields.versions.type='string';},/versions must be an explicit boolean/],
  ]){
    const value=structuredClone(original);change(value);await fs.writeFile(file,JSON.stringify(value));
    await assert.rejects(checkEngineContract(dir),pattern);
  }
});

test('checker enforces dedicated Catalog launch scalar maps human input routes and role fields',async t=>{
  const dir=await temp(t),schema=await fixture(dir),plan=path.join(schema,'base/aiCatalogStackLaunchPlan.json');
  const original=JSON.parse(await fs.readFile(plan,'utf8'));
  for(const [change,pattern] of [
    [value=>{value.resourceFields.optionsRef.required=false;},/optionsRef must be required/],
    [value=>{value.resourceFields.answers.type='string';},/answers type mismatch/],
    [value=>{value.resourceActions.completeInputs.input='aiResourceChangePlan';},/aiCatalogStackLaunchInputs/],
    [value=>{value.resourceFields.summary.create=true;},/summary must not be model input/],
  ]){const value=structuredClone(original);change(value);await fs.writeFile(plan,JSON.stringify(value));await assert.rejects(checkEngineContract(dir),pattern);}
  await fs.writeFile(plan,JSON.stringify(original));
  const input=path.join(schema,'base/aiCatalogStackLaunchInputs.json'),closed=JSON.parse(await fs.readFile(input,'utf8'));
  await fs.writeFile(input,JSON.stringify({...closed,collectionMethods:['POST']}));await assert.rejects(checkEngineContract(dir),/must not have its own collection route/);
  await fs.writeFile(input,JSON.stringify(closed));
  const file=path.join(schema,'project/project-auth.json'),role=JSON.parse(await fs.readFile(file,'utf8'));
  delete role.authorize['aiCatalogStackLaunchInputs.referenceBindings'];await fs.writeFile(file,JSON.stringify(role));
  await assert.rejects(checkEngineContract(dir),/project cannot accept aiCatalogStackLaunchInputs.referenceBindings/);
});
test('checker retains readonly Catalog required operations and action-only input metadata in every role',async t=>{
  const dir=await temp(t),schema=await fixture(dir);await checkEngineContract(dir);
  for(const roleName of ['admin','user','project']){
    const file=path.join(schema,roleName,roleName+'-auth.json'),role=JSON.parse(await fs.readFile(file,'utf8'));
    assert.equal(role.authorize.aiCatalogStackLaunchInputs,'r');
    role.authorize['aiCatalogStackLaunchInputs.answers']='c';await fs.writeFile(file,JSON.stringify(role));
    await assert.rejects(checkEngineContract(dir),new RegExp(roleName+' cannot retain input metadata aiCatalogStackLaunchInputs.answers'));
    role.authorize['aiCatalogStackLaunchInputs.answers']='cr';
    delete role.authorize['aiCatalogStackLaunchOptions.requiredOperations'];await fs.writeFile(file,JSON.stringify(role));
    await assert.rejects(checkEngineContract(dir),new RegExp(roleName+' cannot read safe aiCatalogStackLaunchOptions.requiredOperations'));
    role.authorize['aiCatalogStackLaunchOptions.requiredOperations']='r';await fs.writeFile(file,JSON.stringify(role));
  }
  const file=path.join(schema,'base/aiCatalogStackLaunchOptions.json'),options=JSON.parse(await fs.readFile(file,'utf8'));
  options.resourceFields.requiredOperations.create=true;await fs.writeFile(file,JSON.stringify(options));
  await assert.rejects(checkEngineContract(dir),/requiredOperations must not be model input/);
});
test('checker Catalog options-only mode keeps readonly and three-role gates without rerunning old contracts',async t=>{
  const dir=await temp(t),schema=await fixture(dir);
  await fs.unlink(path.join(schema,'base/aiServiceUpgradePlan.json'));
  await checkEngineContract(dir,{catalogOptionsOnly:true});
  const file=path.join(schema,'user/user-auth.json'),role=JSON.parse(await fs.readFile(file,'utf8'));
  delete role.authorize['aiCatalogStackLaunchOptions.requiredOperations'];await fs.writeFile(file,JSON.stringify(role));
  await assert.rejects(checkEngineContract(dir,{catalogOptionsOnly:true}),/user cannot read safe aiCatalogStackLaunchOptions.requiredOperations/);
});
test('checker rejects directory links escaping the selected Engine and schema roots',async t=>{
  const dir=await temp(t),outside=await temp(t);await fixture(outside);
  await fs.mkdir(path.join(dir,'resources/content'),{recursive:true});
  await fs.symlink(path.join(outside,'resources/content/schema'),path.join(dir,'resources/content/schema'),'junction');
  await assert.rejects(checkEngineContract(dir),/Schema root escapes selected Engine/);
  const other=await temp(t),schema=await fixture(other);
  await fs.rename(path.join(schema,'base'),path.join(schema,'old-base'));
  await fs.symlink(path.join(outside,'resources/content/schema/base'),path.join(schema,'base'),'junction');
  await assert.rejects(checkEngineContract(other),/Schema file escapes selected Engine/);
});
test('UI test filtering treats regex metacharacters literally',()=>{
  const script=path.join(web,'scripts/test-ai-collaboration-ui.js');
  const run=value=>spawnSync(process.execPath,[script,'--filter='+value],{cwd:web,encoding:'utf8',timeout:10000});
  assert.equal(run('initialization').status,0);
  const rejected=run('initialization|mode controls');assert.equal(rejected.status,1);assert.match(rejected.stderr,/test filter matched no cases/);
});
test('checker CLI does not echo an unreadable selected path',()=>{
  const marker='private-selected-directory-must-not-be-logged';
  const result=spawnSync(process.execPath,[path.join(web,'scripts/check-webmcp-engine-contract.mjs'),'--engine-root',path.join(tmpdir(),marker)],{cwd:web,encoding:'utf8',timeout:10000});
  assert.equal(result.status,1);assert.match(result.stderr,/WebMCP Engine contract check failed/);
  assert.equal((result.stdout+result.stderr).includes(marker),false);
});
