import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Compile only these fixed trusted sources; never evaluate caller-provided JavaScript.
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
// Use the same contract as the browser and bridge, without a separate copy.
const shared = new URL('../app/utils/', import.meta.url);
const registry = moduleUrl(await fs.readFile(new URL('ai-resource-registry.js', shared), 'utf8'));
const contract = moduleUrl((await fs.readFile(new URL('ai-command-contract.js', shared), 'utf8')).replace("'./ai-resource-registry'", JSON.stringify(registry)));
const source = await fs.readFile(new URL('../app/utils/ai-catalog-reader.js', import.meta.url), 'utf8');
const {createCatalogReader} = await import(moduleUrl(source.replace("'./ai-command-contract'", JSON.stringify(contract))));
const secret = 'PRIVATE_CONFIG_OR_COMPOSE_MUST_NOT_LEAVE';
const logical = id => 'ctm-' + createHash('sha256').update(`fixture-${id}`).digest('hex');
const row = (id, extra={}) => ({id: logical(id), type: 'catalogTemplate', name: 'Template', templateKey: `folder-${id}`, description: 'Untrusted description', catalogScope: 'global', ...extra});
function marker(n,id=logical(n)) { const bytes=Buffer.alloc(57);bytes[0]=1;bytes.writeBigUInt64BE(BigInt(n),1);Buffer.from(id.slice(4),'hex').copy(bytes,9);return 'cmc-'+bytes.toString('base64url'); }
function fixture(handler) {
  const captured = {projectId: '1a5', generation: 1};
  let current = true;
  const requests=[];
  const context = {assertCurrent(value, signal) {
    if (!current || value !== captured) throw Object.assign(new Error('CONTEXT_CHANGED'), {code: 'CONTEXT_CHANGED'});
    if(signal?.aborted) throw Object.assign(new Error('CANCELLED'), {code: 'CANCELLED'});
  }};
  const reader=createCatalogReader({context, request: async options => {requests.push(options); return handler ? handler(options) : {body:{resourceType:'catalogTemplate',data:[],nextMarker:null}};}});
  return {reader,captured,requests,change(){current=false;}};
}
test('catalog reader uses one fixed typed authorized request and never accepts caller routing or credentials', async () => {
  const f=fixture(); await f.reader.find({query:'name'},f.captured);
  assert.deepEqual(f.requests[0],{url:'projects/1a5/aiCatalogMetadataViews',method:'POST',data:{query:'name'},signal:undefined});
  for(const bad of [{url:'https://other'},{method:'DELETE'},{headers:{Authorization:secret}},{projectId:'1a6'},{query:1},{query:'x'.repeat(257)}]) {
    await assert.rejects(f.reader.find(bad,f.captured),e=>e.code==='INVALID_INPUT');
  }
  assert.equal(f.requests.length,1);
});
test('catalog reader projects only bounded metadata and reports truncation without nested defaults or links', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(1,{name:'n'.repeat(513),description:'d'.repeat(1025),questions:[{default:secret}],files:secret,readme:secret,icon:secret,links:{self:secret},versionLinks:{v:secret},environment:{TOKEN:secret}})],nextMarker:null}}));
  const result=await f.reader.find({},f.captured);
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(result.data[0].name.length,512);assert.equal(result.data[0].description.length,1024);
  assert.deepEqual(result.data[0].truncatedFields,['description','name']);
});
test('catalog reader preserves exact metadata identity and never builds a path from a model ID', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(12)],nextMarker:null}}));
  await f.reader.get({id:logical(12)},f.captured);
  assert.deepEqual(f.requests[0].data,{templateId:logical(12)});
  for(const id of ['../accounts','ctm-0','ctm-12','ctm-1?x','https://other','ctm-1/2','catalog:folder'])await assert.rejects(f.reader.get({id},f.captured),e=>e.code==='INVALID_INPUT');
  assert.equal(f.requests.length,1);
});
test('catalog reader forwards one keyset marker and rejects replayed, duplicate or nonprogressing pages', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(51),row(52)],nextMarker:marker(52)}}));
  const next=await f.reader.find({query:'Template',marker:marker(50)},f.captured);
  assert.equal(next.nextMarker,marker(52));assert.deepEqual(f.requests[0].data,{query:'Template',marker:marker(50)});
  for(const body of [{data:[row(51),row(51)],nextMarker:null},{data:[row(49)],nextMarker:marker(49)},{data:[row(52)],nextMarker:marker(53)}]) {
    const x=fixture(()=>({body:{resourceType:'catalogTemplate',...body}}));
    await assert.rejects(x.reader.find({marker:marker(50)},x.captured),e=>e.code==='INVALID_RESPONSE');
  }
});
test('catalog reader rejects oversized pages, wrong identity/type and malformed safe fields', async () => {
  for(const body of [{resourceType:'catalogTemplate',data:Array.from({length:51},(_,i)=>row(i+1))},
    {resourceType:'service',data:[]},{resourceType:'catalogTemplate',data:[row(1,{name:{value:secret}})]},
    {resourceType:'catalogTemplate',data:[row(1,{truncatedFields:['password']})]}]) {
    const f=fixture(()=>({body}));await assert.rejects(f.reader.find({},f.captured),e=>e.code==='INVALID_RESPONSE');
  }
  const f=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(13)],nextMarker:null}}));
  await assert.rejects(f.reader.get({id:logical(12)},f.captured),e=>e.code==='INVALID_RESPONSE');
});
test('catalog reader invalidates late success and late failure after context change, and respects cancellation', async () => {
  for(const failure of [false,true]) {
    let done;const pending=new Promise((resolve,reject)=>{done=()=>failure?reject(new Error(secret)):resolve({body:{resourceType:'catalogTemplate',data:[row(1)]}});});
    const f=fixture(()=>pending);const result=f.reader.find({},f.captured);f.change();done();
    await assert.rejects(result,e=>e.code==='CONTEXT_CHANGED');
  }
  const f=fixture(),signal=AbortSignal.abort();await assert.rejects(f.reader.find({},f.captured,signal),e=>e.code==='CANCELLED');assert.equal(f.requests.length,0);
});

const versionId = id => 'cvm-' + createHash('sha256').update(`version-${id}`).digest('hex');
test('template logical key is safe metadata and distinguishes same display name and description', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(1,{templateKey:'mysql-small'}),row(2,{templateKey:'mysql-large'})]}}));
  const result=await f.reader.find({},f.captured);assert.deepEqual(result.data.map(r=>r.templateKey),['mysql-small','mysql-large']);
  assert.equal(result.data[0].name,result.data[1].name);assert.equal(result.data[0].description,result.data[1].description);
  for(const templateKey of ['', '/tmp/cache/template', 'C:\\cache\\template', 'https://private.example/secret', 'key\nother\nlast']) {
    const bad=fixture(()=>({body:{resourceType:'catalogTemplate',data:[row(1,{templateKey})]}}));
    await assert.rejects(bad.reader.find({},bad.captured),e=>e.code==='INVALID_RESPONSE');
  }
});
const versionRow = (id, extra={}) => ({id:versionId(id),type:'catalogTemplateVersion',templateId:logical(1),version:'1.0.0',revision:id,minimumRancherVersion:'1.6.0',...extra});
test('version reader requires a template and only forwards fixed typed metadata parameters', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplateVersion',data:[versionRow(1)],nextMarker:null}}));
  await f.reader.findVersions({templateId:logical(1)},f.captured);
  await f.reader.getVersion({templateId:logical(1),versionId:versionId(1)},f.captured);
  assert.deepEqual(f.requests.map(r=>r.data),[{templateId:logical(1),versions:true},{templateId:logical(1),versions:true,versionId:versionId(1)}]);
  for(const input of [{},{templateId:'ctm-1'},{templateId:logical(1),query:'x'},{templateId:logical(1),url:secret}])
    await assert.rejects(f.reader.findVersions(input,f.captured),e=>e.code==='INVALID_INPUT');
  await assert.rejects(f.reader.getVersion({templateId:logical(1),versionId:'10'},f.captured),e=>e.code==='INVALID_INPUT');
  assert.equal(f.requests.length,2);
});
test('version reader excludes launch files and defaults and refuses foreign parent or unsafe revisions', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplateVersion',data:[versionRow(1,{files:secret,questions:secret,defaultAnswers:secret,readme:secret})]}}));
  const result=await f.reader.getVersion({templateId:logical(1),versionId:versionId(1)},f.captured);
  assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(result.data[0].revision,1);
  for(const extra of [{templateId:logical(2)},{revision:-1},{revision:0.5},{revision:Number.MAX_SAFE_INTEGER+1},{truncatedFields:['files']}]) {
    const bad=fixture(()=>({body:{resourceType:'catalogTemplateVersion',data:[versionRow(1,extra)]}}));
    await assert.rejects(bad.reader.findVersions({templateId:logical(1)},bad.captured),e=>e.code==='INVALID_RESPONSE');
  }
});
test('version cursor advances by private locator while retaining logical version identity', async () => {
  const f=fixture(()=>({body:{resourceType:'catalogTemplateVersion',data:[versionRow(11)],nextMarker:marker(11,versionId(11))}}));
  const result=await f.reader.findVersions({templateId:logical(1),marker:marker(10,versionId(10))},f.captured);
  assert.equal(result.nextMarker,marker(11,versionId(11)));
  assert.equal(f.requests[0].data.marker,marker(10,versionId(10)));
});
