import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBridge, createTransport, validateConfig, allowedRequest} from '../core.mjs';
import {CommandContext, CommandEngine, CommandError, COMMANDS} from '../shared-modules.mjs';

const secret = 'secret-sentinel-that-must-never-appear';
const config = {endpoint:'http://127.0.0.1:8888',environment:'Default',accessKey:'access-test',secretKey:secret};
const response = (data, revision='1', purpose='ai-bridge') => new Response(JSON.stringify(data), {headers:{'content-type':'application/json','X-PastureStack-Key-Purpose':purpose,'X-PastureStack-Key-Revision':revision}});

test('external TCP create uses the shared bridge schema owner and immutable human review without a new route', async () => {
  const healthCheck = {port: 443, interval: 2000, responseTimeout: 1000, healthyThreshold: 2, unhealthyThreshold: 3};
  const requests = [], id = 'aichange-11111111-1111-1111-1111-111111111111';
  let plan, writes = 0;
  const bridge = await createBridge(config, {fetcher: async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : undefined; requests.push({path: url.pathname, search: url.search, data});
    if (url.pathname.endsWith('/projects')) return response({data: [{id: 'p1', name: 'Default', state: 'active'}]});
    if (url.pathname.endsWith('/aiToolCallEvents')) return response({accepted: true, requestId: 'request-' + requests.length});
    if (url.pathname.endsWith('/aiResourceViews')) return response({resourceType: 'stack', data: [{id: 'st1', name: 'Stack', accountId: 'p1'}]});
    if (url.pathname.endsWith('/aiResourceChangePlans')) {
      plan = {id, resourceType: 'externalService', operation: 'create', resourceId: null, targetPath: 'Default/Stack/db',
        confirmationState: 'pending', status: 'preview', verifiedResult: false, changes: [
          {field: 'name', before: null, after: 'db'}, {field: 'hostname', before: null, after: 'db.example.test'},
          {field: 'healthCheck', before: null, after: JSON.stringify(data.parameters.healthCheck)}, {field: 'startOnCreate', before: null, after: false}]};
      return response(plan);
    }
    if (url.search === '?action=apply') { writes++; return response({...plan, status: 'accepted'}); }
    if (url.pathname.endsWith('/' + id)) return response(plan);
    throw Error('Unexpected external TCP bridge route');
  }});
  try {
    const parents = await bridge.engine.execute('find_resources', {family: 'stack', query: 'Stack'});
    const input = {resourceType: 'externalService', operation: 'create', parentRef: parents.items[0].resourceRef,
      parameters: {name: 'db', hostname: 'db.example.test', healthCheck}};
    const preview = await bridge.engine.execute('preview_resource_change', input);
    assert.equal(preview.status, 'needs_user');
    assert.deepEqual(requests.find(row => row.path.endsWith('/aiResourceChangePlans')).data,
      {resourceType: 'externalService', operation: 'create', parameters: {...input.parameters, stackId: 'st1'}});
    const count = requests.filter(row => row.path.endsWith('/aiResourceChangePlans')).length;
    assert.equal((await bridge.engine.execute('preview_resource_change', {...input, parameters: {...input.parameters,
      healthCheck: {...healthCheck, requestLine: 'GET / HTTP/1.0'}}})).code, 'INVALID_INPUT');
    assert.equal(requests.filter(row => row.path.endsWith('/aiResourceChangePlans')).length, count);
    plan.confirmationState = 'approved'; // Represents a separate human server-side approval.
    plan.changes.find(row => row.field === 'healthCheck').after = JSON.stringify({...healthCheck, port: 8443});
    assert.equal((await bridge.engine.execute('apply_resource_change', {planRef: preview.planRef})).code, 'CONFLICT');
    assert.equal(writes, 0);
    assert.equal(allowedRequest('projects/p1/aiResourceChangePlans/' + id + '?action=confirm', 'POST', 'p1'), false);
    assert.equal(requests.some(row => row.path.includes('/externalServices')), false);
    assert.equal(JSON.stringify(preview).includes(secret), false); assert.equal(COMMANDS.length, 12);
  } finally { bridge.close(); }
});

test('upgrade strategy uses the shared bridge engine and exact preview with separate human approval', async () => {
  const strategy = {startFirst: true, batchSize: 2, intervalMillis: 1500}, requests = [];
  let approved = false, writes = 0;
  const plan = {id: 'aiplan-11111111-1111-1111-1111-111111111111', serviceId: 's1', serviceName: 'web',
    displayPath: 'Default/Stack/web', currentImage: 'docker:app:1', requestedImage: 'docker:app:2', upgradeStrategy: strategy};
  const bridge = await createBridge(config, {fetcher: async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : undefined; requests.push({path: url.pathname, search: url.search, data});
    if (url.pathname.endsWith('/projects')) return response({data: [{id: 'p1', name: 'Default', state: 'active'}]});
    if (url.pathname.endsWith('/aiToolCallEvents')) return response({accepted: true, requestId: 'request-' + requests.length});
    if (url.pathname.endsWith('/services')) return response({data: [{id: 's1', accountId: 'p1', stackId: 'st1', name: 'web'}]});
    if (url.pathname.endsWith('/stacks')) return response({data: [{id: 'st1', accountId: 'p1', name: 'Stack'}]});
    if (url.pathname.endsWith('/aiServiceUpgradePlans')) return response({...plan, confirmationState: 'pending', status: 'preview'});
    if (url.search === '?action=apply') {
      if (!approved) return new Response(JSON.stringify({code: 'UpgradeNeedsConfirmation'}), {status: 409});
      writes++; return response({...plan, confirmationState: 'approved', status: 'accepted', verifiedResult: false});
    }
    throw Error('Unexpected bridge upgrade strategy request');
  }});
  const found = await bridge.engine.execute('find_services', {query: 'web'});
  const preview = await bridge.engine.execute('preview_service_upgrade', {serviceRef: found.items[0].serviceRef, image: 'app:2', ...strategy});
  assert.equal(preview.status, 'needs_user'); assert.deepEqual(preview.upgradeStrategy, strategy);
  assert.deepEqual(requests.find(row => row.path.endsWith('/aiServiceUpgradePlans')).data, {serviceId: 's1', image: 'app:2', ...strategy});
  assert.equal((await bridge.engine.execute('apply_service_upgrade', {planRef: preview.planRef})).code, 'NEEDS_USER'); assert.equal(writes, 0);
  assert.equal(allowedRequest('projects/p1/aiServiceUpgradePlans/' + plan.id + '?action=confirm', 'POST', 'p1'), false);
  approved = true; // The fixture now represents a separately server-approved plan.
  assert.equal((await bridge.engine.execute('apply_service_upgrade', {planRef: preview.planRef})).status, 'accepted');
  assert.equal(writes, 1); assert.deepEqual(requests.at(-2).data, {});
  assert.equal(JSON.stringify(preview).includes(secret), false); bridge.close();
});

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

test('audit admission reports real transport auth and revision failures without business dispatch', async () => {
  for (const [status,code,expected] of [[401,'AuthenticationRequired','SESSION_REQUIRED'],
    [403,'PermissionDenied','FORBIDDEN'],[403,'ApiKeyPolicyChanged','FORBIDDEN'],
    [200,'ApiKeyPolicyChanged','CONTEXT_CHANGED']]) {
    let admitted=false;const calls=[];
    const bridge=await createBridge(config,{fetcher:async(url,options)=>{
      calls.push({path:url.pathname,method:options.method,revision:options.headers['X-PastureStack-Key-Expected-Revision']});
      if(!admitted)return response({data:[{id:'p1',name:'Default',state:'active'}]});
      return status===200?response({accepted:true,requestId:'ack'},'2'):
        new Response(JSON.stringify({code,message:secret}),{status});
    }});
    admitted=true;const initial=calls.length;
    const result=await bridge.engine.execute('find_resources',{family:'audit',resourceType:'auditLog',auditFilters:{lastMinutes:10,limit:1}});
    assert.equal(result.status,'rejected');assert.equal(result.code,expected);
    assert.deepEqual(calls.slice(initial),[{path:'/v2-beta/projects/p1/aiToolCallEvents',method:'POST',revision:'1'}]);
    assert.equal(JSON.stringify(result).includes(secret),false);
    assert.doesNotMatch(result.nextStep,/select an environment|enable this integration/);
    if(code==='ApiKeyPolicyChanged')assert.match(result.nextStep,/Key policy changed.*reconnect/);
    bridge.close();
  }
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
  assert.deepEqual(bridge.tools.map(item=>item.name),COMMANDS.map(item=>item.name));
  assert.equal(calls.some(call=>call.url.includes('/token')),false);
  bridge.close();
});
