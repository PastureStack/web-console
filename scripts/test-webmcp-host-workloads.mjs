import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

function fixture(transportKind = 'browser') {
  const snapshot = {generation:'g1',accountId:'a1',projectId:'p1',projectName:'Environment',schemaProjectId:'p1',schemaGeneration:1,route:'/hosts'};
  let next=0, mutate;
  const context=new CommandContext(()=>snapshot,()=>`opaque${++next}`);context.setMode('read-only');
  const body={id:'h1',type:'host',name:'Host A',state:'active',agentState:'active',memory:4096,milliCpu:2000,localStorageMb:8192,
    workloadReferencesStatus:'unknown',workloadReferences:[
      {containerId:'INTERNAL_11',name:'same',state:'running',stackResolution:'resolved',stackName:'Blue'},
      {containerId:'INTERNAL_12',name:'same',state:'stopped',stackResolution:'resolved',stackName:'Green'},
    ]}, requests=[];
  const engine=new CommandEngine({context,transportKind,ensureSession:async()=>{},audit:async()=>({accepted:true,requestId:`audit${++next}`}),request:async request=>{
    requests.push(request);if(mutate)mutate();
    if(request.url==='projects/p1/aiResourceViews')return {body:{resourceType:request.data.resourceType,data:[request.data.resourceType==='host'?body:{id:request.data.resourceId,type:'container',name:'same',state:'stopped'}]}};
    if(request.url.startsWith('projects/p1/containers/'))return {body:{id:request.url.split('/').at(-1),name:'same',state:'stopped'}};
    throw Error('Unexpected transport');
  }});
  const ref=context.reference('resource',{id:'h1',family:'host',resourceType:'host',scope:'project'},context.capture());
  return {snapshot,context,engine,body,requests,ref,mutate:fn=>{mutate=fn;}};
}

test('Host workloads use the same typed owner in browser and Bridge and mint exact same-name Container references',async()=>{
  for(const transport of ['browser','stdio']){
    const f=fixture(transport),r=await f.engine.execute('get_resource',{resourceRef:f.ref});
    assert.equal(r.status,'succeeded');assert.equal(r.workloadReferences.availability,'unknown');assert.equal(r.workloadReferences.limit,50);
    const [a,b]=r.workloadReferences.items;assert.notEqual(a.containerRef,b.containerRef);assert.equal(a.stackName,'Blue');assert.equal(b.stackName,'Green');assert.equal(b.state,'stopped');
    assert.deepEqual([r.fields.agentState,r.fields.memory,r.fields.milliCpu,r.fields.localStorageMb],['active',4096,2000,8192]);
    assert.doesNotMatch(JSON.stringify(r),/INTERNAL_|containerId|instanceIds|launchConfig/);
    assert.equal(f.requests[0].url,'projects/p1/aiResourceViews');assert.equal(f.requests[0].data.resourceId,'h1');
    assert.equal((await f.engine.execute('get_resource',{resourceRef:b.containerRef})).status,'succeeded');
    f.snapshot.generation='g2';assert.equal((await f.engine.execute('get_resource',{resourceRef:a.containerRef})).code,'STALE_REFERENCE');
  }
});

test('Host empty old-server hidden and fifty-row snapshots remain unknown without lifecycle authority',async()=>{
  for(const shape of [[],undefined,Array.from({length:50},(_,i)=>({containerId:`private${i}`,name:'same',state:'stopped',stackResolution:'unknown'}))]){
    const f=fixture();f.body.workloadReferences=shape;if(shape===undefined)delete f.body.workloadReferencesStatus;
    f.body.hiddenCount=999;f.body.instanceIds=['PRIVATE_HIDDEN'];f.body.launchConfig={password:'PRIVATE_SECRET'};
    const r=await f.engine.execute('get_resource',{resourceRef:f.ref});assert.equal(r.status,'succeeded');assert.equal(r.workloadReferences.items.length,shape?.length||0);
    assert.equal(r.workloadReferences.availability,'unknown');assert.match(r.nextStep,/Empty results do not mean an empty Host or safe evacuation/);
    assert.doesNotMatch(JSON.stringify(r),/PRIVATE_|hiddenCount|999|instanceIds|launchConfig|containerId/);
    assert.equal((await f.engine.execute('preview_resource_change',{resourceType:'host',operation:'deactivate',targetRef:f.ref,parameters:{}})).code,'INVALID_INPUT');
    assert.ok(f.requests.every(x=>x.url==='projects/p1/aiResourceViews'&&x.method==='POST'));assert.equal(COMMANDS.length,12);
  }
});

test('Host closed projection rejects malformed cross-ID duplicate oversized or stale output before minting child references',async()=>{
  for(const alter of [f=>{f.body.id='h2';},f=>{f.body.workloadReferencesStatus='complete';},f=>{f.body.workloadReferences=Array(51).fill(f.body.workloadReferences[0]);},
    f=>{f.body.workloadReferences[0].hostPath='/PRIVATE';},f=>{f.body.workloadReferences[0].stackResolution='unknown';},
    f=>{f.body.workloadReferences[0].containerId='../PRIVATE';},f=>{f.body.workloadReferences[1].containerId=f.body.workloadReferences[0].containerId;}]){
    const f=fixture();alter(f);const r=await f.engine.execute('get_resource',{resourceRef:f.ref});assert.equal(r.code,'INVALID_RESPONSE');assert.equal(r.workloadReferences,undefined);assert.doesNotMatch(JSON.stringify(r),/PRIVATE|INTERNAL_|Blue/);
  }
  const race=fixture();race.mutate(()=>{race.snapshot.generation='g2';});const r=await race.engine.execute('get_resource',{resourceRef:race.ref});assert.ok(['CONTEXT_CHANGED','STALE_REFERENCE'].includes(r.code));assert.equal(r.workloadReferences,undefined);
  const raw=fixture();assert.equal((await raw.engine.execute('get_resource',{resourceRef:'INTERNAL_11'})).code,'STALE_REFERENCE');assert.equal(raw.requests.length,0);
});
