import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBridge, createTransport, validateConfig, allowedRequest} from '../core.mjs';
import {CommandContext, CommandEngine, CommandError} from '../shared-modules.mjs';

const secret = 'secret-sentinel-that-must-never-appear';
const config = {endpoint:'http://127.0.0.1:8888',environment:'Default',accessKey:'access-test',secretKey:secret};
const response = (data, revision='1', purpose='ai-bridge') => new Response(JSON.stringify(data), {headers:{'content-type':'application/json','X-PastureStack-Key-Purpose':purpose,'X-PastureStack-Key-Revision':revision}});

test('shared Node loader preserves Ember imports and one contract error identity', async () => {
  for (const name of ['ai-command-context', 'ai-command-engine']) {
    const source = await readFile(new URL(`../../app/utils/${name}.js`, import.meta.url), 'utf8');
    assert.match(source, /from '\.\/ai-command-contract';/);
    assert.doesNotMatch(source, /from '\.\/ai-command-contract\.js'/);
  }
  assert.equal(typeof CommandEngine, 'function');
  const context = new CommandContext(() => ({}));
  assert.throws(() => context.capture(), error => error instanceof CommandError && error.code === 'UNAVAILABLE');
});

test('configuration rejects remote HTTP, URL credentials, fragments and unknown options', () => {
  for (const patch of [{endpoint:'http://192.168.1.1:8080'}, {endpoint:'https://user:secret@example.test'},
    {endpoint:'https://example.test/#token'}, {allowUnsafe:true}, {secretKey:''}]) {
    assert.throws(() => validateConfig({...config,...patch}));
  }
  assert.equal(validateConfig(config).endpoint, config.endpoint);
});

test('transport exposes only fixed routes and never a confirmation or generic proxy', () => {
  assert.equal(allowedRequest('projects/p1/services?limit=50','GET','p1'),true);
  assert.equal(allowedRequest('projects/p1/aiServiceUpgradePlans/plan1?action=apply','POST','p1'),true);
  for (const [path,method] of [['projects/p2/services','GET'],['projects/p1/services/s1','PUT'],
    ['projects/p1/aiServiceUpgradePlans/p1?action=confirm','POST'],['../token','GET'],
    ['https://other.test/projects/p1/services','GET'],['projects/p1/containers/c1?action=execute','POST']]) {
    assert.equal(allowedRequest(path,method,'p1'),false,path);
  }
  for(const path of ['https://local.invalid/projects/p1/services','//local.invalid/projects/p1/services',
    '../projects/p1/services','/projects/p1/services','projects/p1/../p1/services']) {
    assert.equal(allowedRequest(path,'GET','p1'),false,path);
  }
});

test('credentials stay in one-origin authorization; redirects and cookies are disabled', async () => {
  let options, address;
  const request=createTransport(config,async (url,opts)=>{address=url;options=opts;return response({data:[]});});
  const result=await request({url:'projects/p1/services'},'p1');
  assert.equal(address.origin,config.endpoint);
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.ok(options.headers.Authorization.startsWith('Basic '));
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal('Cookie' in options.headers,false);
});

test('ambiguous or cross-origin environment discovery never silently selects or forwards secrets', async () => {
  await assert.rejects(createBridge(config,{fetcher:async()=>response({data:[{id:'p1',name:'Default',state:'active'},{id:'p2',name:'Default',state:'active'}]})}),{code:'AMBIGUOUS_ENVIRONMENT'});
  let calls=0;
  await assert.rejects(createBridge(config,{fetcher:async()=>{calls++;return response({data:[],pagination:{next:'https://evil.test/projects'}});}}),{code:'INVALID_ENVIRONMENT_PAGE'});
  assert.equal(calls,1);
});

test('server failures reveal only safe status and code, not body or credentials', async () => {
  const request=createTransport(config,async()=>new Response(JSON.stringify({code:'PermissionDenied',message:secret}),{status:403}));
  try { await request({url:'projects/p1/services'},'p1');assert.fail(); }
  catch (error) { assert.equal(error.status,403);assert.equal(JSON.stringify(error).includes(secret),false); }
});

test('oversized responses and cancelled calls fail closed', async () => {
  const large=createTransport(config,async()=>response({value:'x'.repeat(1024*1024)}));
  await assert.rejects(large({url:'projects/p1/services'},'p1'),{code:'INVALID_RESPONSE'});
  const abort=new AbortController();abort.abort();
  const cancelled=createTransport(config,async()=>{throw new Error(secret);});
  await assert.rejects(cancelled({url:'projects/p1/services',signal:abort.signal},'p1'),{code:'CANCELLED'});
});

test('bridge requires server-verified dedicated purpose and never adopts a new key revision silently', async () => {
  const ordinary=createTransport(config,async()=>response({data:[]},'1','general'));
  await assert.rejects(ordinary({url:'projects?limit=100'},null,true),{code:'DEDICATED_KEY_REQUIRED'});
  let revision='1';
  const changed=createTransport(config,async()=>response({data:[]},revision));
  await changed({url:'projects/p1/services'},'p1');
  revision='2';
  await assert.rejects(changed({url:'projects/p1/services'},'p1'),{code:'CONTEXT_CHANGED'});
});

test('bootstrap pins a revision and every later request sends it before a mutation can execute', async () => {
  let revision='1', writes=0;
  const seen=[];
  const request=createTransport(config,async(_url,options)=>{
    seen.push(options.headers['X-PastureStack-Key-Expected-Revision']);
    if(options.method==='POST' && options.headers['X-PastureStack-Key-Expected-Revision']!==revision) {
      return new Response(JSON.stringify({code:'ApiKeyPolicyChanged'}),{status:403});
    }
    if(options.method==='POST') writes++;
    return response({data:[]},revision);
  });
  await request({url:'projects?limit=100'},null,true);
  await request({url:'projects/p1/services'},'p1');
  revision='2';
  await assert.rejects(request({url:'projects/p1/aiServiceDescriptionUpdates',method:'POST',
    data:{serviceId:'s1',description:'new',expectedDescription:'old'}},'p1'),error=>error.status===403&&error.body.code==='ApiKeyPolicyChanged');
  assert.deepEqual(seen,[undefined,'1','1']);
  assert.equal(writes,0);
});

test('shared business engine lists scoped refs and reports authorization failure without cookie fallback', async () => {
  const calls=[];
  const bridge=await createBridge(config,{fetcher:async(url,opts)=>{
    calls.push({url:String(url),method:opts.method});
    if(url.pathname.endsWith('/projects'))return response({data:[{id:'p1',name:'Default',state:'active'}]});
    if(url.pathname.endsWith('/aiToolCallEvents'))return response({accepted:true,requestId:'request-'+calls.length});
    if(url.pathname.endsWith('/services'))return response({data:[{id:'s1',accountId:'p1',stackId:'st1',name:'web',description:null}]});
    if(url.pathname.endsWith('/stacks'))return response({data:[{id:'st1',accountId:'p1',name:'Stack'}]});
    return new Response(JSON.stringify({code:'PermissionDenied',message:secret}),{status:403});
  }});
  const found=await bridge.engine.execute('find_services',{query:'web'});
  assert.equal(found.status,'succeeded');assert.equal(found.items[0].displayPath,'Default/Stack/web');
  const denied=await bridge.engine.execute('get_service',{serviceRef:found.items[0].serviceRef});
  assert.equal(denied.code,'FORBIDDEN');assert.equal(JSON.stringify(denied).includes(secret),false);
  assert.equal(bridge.tools.length,7);
  assert.equal(calls.some(call=>call.url.includes('/token')),false);
  bridge.close();
});
