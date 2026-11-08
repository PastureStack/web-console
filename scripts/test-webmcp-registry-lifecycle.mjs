import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
import {resourceDescriptor, safeResourceFields} from '../app/utils/ai-resource-registry.js';

const privateValue='PRIVATE_REGISTRY_SECRET';
function fixture(transportKind='browser',mutatePlan=value=>value) {
  const snapshot={generation:'g1',accountId:'a1',projectId:'p1',projectName:'Project',schemaProjectId:'p1',schemaGeneration:1};
  let sequence=0,plan,dispatches=0,denial;
  const context=new CommandContext(()=>snapshot,()=>String(++sequence));context.setMode('enabled');
  const requests=[],engine=new CommandEngine({context,transportKind,ensureSession:async()=>{},wait:async()=>{},
    audit:async()=>({accepted:true,requestId:'audit'}),request:async request=>{
      requests.push(request);if(denial)throw denial;
      if(request.url.endsWith('schemas?limit=1000'))return {body:{data:[]}};
      if(request.url.endsWith('/aiResourceViews'))return {body:{resourceType:'registry',data:[
        {id:'native-one',type:'registry',accountId:'p1',state:'inactive',serverAddress:'registry.example:5000'},
        {id:'native-two',type:'registry',accountId:'p1',state:'active',serverAddress:'other.example'},
        {id:'native-unsafe',type:'registry',accountId:'p1',state:'active',serverAddress:`user:${privateValue}@unsafe.example`},
      ].filter(row=>!request.data.resourceId||row.id===request.data.resourceId)}};
      if(request.url.endsWith('/aiResourceChangePlans')) {
        const before=request.data.operation==='stop'?'active':'inactive';
        plan={id:'aichange-00000000-0000-4000-8000-000000000091',resourceType:'registry',operation:request.data.operation,
          resourceId:request.data.resourceId,targetPath:'Project / registry.example:5000',changes:[{field:'state',before,
            after:request.data.operation==='remove'?'removed':before==='inactive'?'active':'inactive'}],
          confirmationState:'pending',status:'preview',verifiedResult:false,expiresAt:'2030-01-01T00:00:00Z'};
        if(request.data.operation==='remove')plan.changes.push({field:'affectedServiceCount',before:0,after:0},
          {field:'affectedInstanceCount',before:0,after:0},{field:'affectedMountCount',before:0,after:null},
          {field:'mountedDataRule',before:null,after:'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'},{field:'affectedCredentialCount',before:2,after:2});
        plan=mutatePlan(plan);return {body:{...plan}};
      }
      if(request.url.endsWith('?action=confirm')) {plan.confirmationState='approved';return {body:{...plan}};}
      if(request.url.endsWith('?action=apply')) {
        if(plan.confirmationState!=='approved')throw {status:409,body:{code:'ResourceChangeNeedsConfirmation'}};
        if(plan.status==='preview'){dispatches++;plan.status='accepted';plan.operationId=plan.id;}
        return {body:{...plan}};
      }
      if(request.url.includes('/aiResourceChangePlans/'))return {body:{...plan}};
      throw Error('Unexpected closed Registry transport');
    }});
  return {engine,context,snapshot,requests,plan:()=>plan,dispatches:()=>dispatches,deny:value=>{denial=value;}};
}

for(const transport of ['browser','stdio']) {
  test(`${transport}: Registry exposes only closed start/stop and safely finds the exact endpoint`,async()=>{
    const f=fixture(transport),cap=await f.engine.execute('list_capabilities',{});
    const registry=cap.families.find(row=>row.family==='registry').resources.find(row=>row.resourceType==='registry');
    assert.deepEqual(registry.operations.filter(operation=>operation!=='remove').sort(),['start','stop']);assert.equal(COMMANDS.length,12);
    const found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry',query:'registry.example:5000'});
    assert.equal(found.status,'succeeded');assert.equal(found.items.length,1);
    assert.equal(found.items[0].fields.serverAddress,'registry.example:5000');assert.match(found.items[0].displayPath,/registry\.example:5000/);
    assert.equal(found.items[0].fields.name,undefined);assert.equal(JSON.stringify(found).includes(privateValue),false);
    const read=await f.engine.execute('get_resource',{resourceRef:found.items[0].resourceRef});
    assert.equal(read.status,'succeeded');assert.equal(read.fields.serverAddress,'registry.example:5000');
  });
  test(`${transport}: each Registry lifecycle needs human approval and an old apply never dispatches twice`,async()=>{
    for(const operation of ['start','stop']) {
      const f=fixture(transport),found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
      const selected=found.items.find(row=>row.fields.serverAddress==='registry.example:5000');assert.ok(selected);
      const preview=await f.engine.execute('preview_resource_change',{resourceType:'registry',operation,targetRef:selected.resourceRef,parameters:{}});
      assert.equal(preview.status,'needs_user');assert.deepEqual(f.requests.at(-1).data.parameters,{});
      assert.equal((await f.engine.execute('apply_resource_change',{planRef:preview.planRef})).code,'NEEDS_USER');assert.equal(f.dispatches(),0);
      await f.engine.confirmPlan(preview.planRef);const accepted=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});
      assert.equal(accepted.status,'accepted');assert.equal(f.dispatches(),1);
      await f.engine.execute('apply_resource_change',{planRef:preview.planRef});assert.equal(f.dispatches(),1);
      f.plan().status='succeeded';f.plan().verifiedResult=true;
      assert.equal((await f.engine.execute('get_operation',{operationRef:accepted.operationRef})).status,'succeeded');
      assert.equal(f.requests.some(row=>/registry[Cc]redential|storage[Pp]ool/.test(row.url)),false);
    }
  });
  test(`${transport}: wrong kind, raw IDs, arbitrary parameters and stale project context cannot create a Registry plan`,async()=>{
    const f=fixture(transport),captured=f.context.capture();
    const registry=f.context.reference('resource',{id:'native-one',family:'registry',resourceType:'registry',scope:'project'},captured);
    const pool=f.context.reference('resource',{id:'native-one',family:'storage',resourceType:'storagePool',scope:'project'},captured);
    const base={resourceType:'registry',operation:'start',targetRef:registry};
    for(const input of [{...base,targetRef:'native-one'},{...base,targetRef:pool},{...base,parameters:{serverAddress:'evil.example'}},
      {...base,parameters:{secretValue:privateValue}},{...base,operation:'purge'}]) {
      const result=await f.engine.execute('preview_resource_change',input);assert.ok(['INVALID_INPUT','STALE_REFERENCE'].includes(result.code));
    }
    assert.equal(f.requests.length,0);f.snapshot.generation='g2';
    assert.equal((await f.engine.execute('preview_resource_change',base)).code,'STALE_REFERENCE');assert.equal(f.requests.length,0);
  });
  test(`${transport}: fresh native authorization rejects revoked and readonly access without leaking the body`,async()=>{
    const f=fixture(transport),found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
    const targetRef=found.items[0].resourceRef;
    for(const status of [401,403]) {
      f.deny({status,body:{code:status===401?'ApiKeyRevoked':'PermissionDenied',message:privateValue}});
      const result=await f.engine.execute('preview_resource_change',{resourceType:'registry',operation:'start',targetRef});
      assert.ok(['SESSION_REQUIRED','FORBIDDEN'].includes(result.code));assert.equal(JSON.stringify(result).includes(privateValue),false);
      assert.equal(f.dispatches(),0);
    }
  });
}

test('Registry address projection reports unknown for unsafe/missing endpoints and keeps unrelated metadata unchanged',()=>{
  const descriptor=resourceDescriptor('registry','registry');
  for(const serverAddress of [undefined,`user:${privateValue}@registry.example`,`registry.example?token=${privateValue}`,
    `registry.example/#${privateValue}`,'https://registry.example','registry.example:0','registry.example:65536','registry.example%40secret']) {
    const safe=safeResourceFields({name:'native name',serverAddress,secretValue:privateValue},descriptor);
    assert.equal(safe.serverAddress,null);assert.equal(safe.addressStatus,'unknown');assert.equal(safe.name,'native name');
    assert.equal(JSON.stringify(safe).includes(privateValue),false);
  }
  assert.equal(safeResourceFields({name:'service'},resourceDescriptor('service','service')).name,'service');
});

for(const transport of ['browser','stdio']) {
  test(`${transport}: inactive Registry removal binds the exact credential count and keeps one human-approved native dispatch`,async()=>{
    const f=fixture(transport),cap=await f.engine.execute('list_capabilities',{});
    assert.deepEqual(cap.families.find(row=>row.family==='registry').resources[0].operations.sort(),['remove','start','stop']);
    const found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'}),targetRef=found.items[0].resourceRef;
    const preview=await f.engine.execute('preview_resource_change',{resourceType:'registry',operation:'remove',targetRef,parameters:{}});
    assert.equal(preview.status,'needs_user');assert.equal(f.dispatches(),0);
    assert.equal(preview.displayDiff.length,6);assert.deepEqual(preview.displayDiff[0],{field:'state',before:'inactive',after:'removed'});
    assert.deepEqual(preview.displayDiff.find(row=>row.field==='affectedCredentialCount'),{field:'affectedCredentialCount',before:2,after:2});
    assert.equal(JSON.stringify(preview).includes(privateValue),false);
    assert.equal((await f.engine.execute('apply_resource_change',{planRef:preview.planRef})).code,'NEEDS_USER');assert.equal(f.dispatches(),0);
    await f.engine.confirmPlan(preview.planRef);
    const result=await f.engine.execute('apply_resource_change',{planRef:preview.planRef});assert.equal(result.status,'accepted');
    assert.equal(f.dispatches(),1);await f.engine.execute('apply_resource_change',{planRef:preview.planRef});assert.equal(f.dispatches(),1);
    assert.equal(f.requests.some(row=>/registry[Cc]redential|storage[Pp]ool/.test(row.url)),false);
    assert.equal(f.requests.some(row=>row.method==='DELETE'),false,'the shared tool submits only the typed plan, never a direct Registry DELETE');
  });
}

test('Registry removal rejects malformed counts and any fresh confirmation or apply review drift',async()=>{
  const base={resourceType:'registry',operation:'remove',parameters:{}};
  for(const mutate of [
    p=>({...p,changes:p.changes.filter(row=>row.field!=='affectedCredentialCount')}),
    ...[-1,257,1.5,'2'].map(value=>p=>({...p,changes:p.changes.map(row=>row.field==='affectedCredentialCount'?{...row,before:value,after:value}:row)})),
    p=>({...p,changes:[...p.changes,{field:'secretValue',before:null,after:privateValue}]}),
  ]) {
    const f=fixture('browser',mutate),found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
    const result=await f.engine.execute('preview_resource_change',{...base,targetRef:found.items[0].resourceRef});
    assert.equal(result.code,'INVALID_RESPONSE');assert.equal(f.dispatches(),0);assert.equal(JSON.stringify(result).includes(privateValue),false);
  }
  for(const action of ['confirm','apply']) {
    const f=fixture(),found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
    const preview=await f.engine.execute('preview_resource_change',{...base,targetRef:found.items[0].resourceRef});
    const count=f.plan().changes.find(row=>row.field==='affectedCredentialCount');count.before=3;count.after=3;
    const result=action==='confirm'?await f.engine.confirmPlan(preview.planRef):await f.engine.execute('apply_resource_change',{planRef:preview.planRef});
    assert.equal(result.code,'CONFLICT');assert.equal(f.dispatches(),0);
    assert.equal(f.requests.some(row=>row.url.endsWith('?action='+action)),false,'fresh GET drift must fail before either POST');
  }
});

test('Registry removal busy response gives a separate stop approval and fresh-preview repair without an automatic write',async()=>{
  const f=fixture(),found=await f.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
  f.deny({status:409,body:{code:'ResourceChangeTargetBusy',message:privateValue}});
  const result=await f.engine.execute('preview_resource_change',{resourceType:'registry',operation:'remove',targetRef:found.items[0].resourceRef});
  assert.equal(result.code,'CONFLICT');assert.match(result.nextStep,/registry\/stop/);assert.match(result.nextStep,/separate human approval/);
  assert.match(result.nextStep,/fresh remove preview/);assert.equal(f.dispatches(),0);assert.equal(JSON.stringify(result).includes(privateValue),false);
});

test('Registry removal human review uses all thirteen localized count labels and fixed escaped cleanup notices',async()=>{
  const source=readFileSync(new URL('../app/utils/ai-resource-review-labels.js',import.meta.url),'utf8');
  const {resourceReviewLabels}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(const locale of ['en-us','de-de','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua','zh-hans','zh-tw']) {
    const yaml=readFileSync(new URL('../translations/'+locale+'.yaml',import.meta.url),'utf8'),values={};
    for(const key of ['affectedCredentialCount','registryRemoveNotice']) {
      const match=yaml.match(new RegExp('^  '+key+': (.+)$','m'));assert.ok(match,locale+': '+key);
      values['webmcp.'+key]=JSON.parse(match[1]);assert.ok(values['webmcp.'+key].length>5);
    }
    const labels=resourceReviewLabels({resourceType:'registry',operation:'remove',displayDiff:[
      {field:'affectedCredentialCount',before:2,after:2}]},key=>values[key]||key);
    assert.equal(labels.displayChanges[0].fieldLabel,values['webmcp.affectedCredentialCount']);
    assert.equal(labels.displayChanges[0].informational,true);
    assert.equal(labels.registryRemoveNotice,values['webmcp.registryRemoveNotice']);
    assert.equal(labels.registryRemoveNotice.includes(privateValue),false);
  }
  const template=readFileSync(new URL('../app/components/modal-confirm-ai-upgrade/template.hbs',import.meta.url),'utf8');
  assert.match(template,/{{this\.reviewLabels\.registryRemoveNotice}}/);assert.doesNotMatch(template,/{{{this\.reviewLabels\.registryRemoveNotice}}}/);
});
