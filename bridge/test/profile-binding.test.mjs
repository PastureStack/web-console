import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, chmod, open, readdir, unlink, rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBridge, createTransport, validateConfig, prepareBoundProfile, allowedRequest} from '../core.mjs';
import {bindProfile, main, parseArguments} from '../bind-profile.mjs';

// A native remove receipt outlives the last active child that provided scoped
// navigation. Its own GET remains subject to native owner/Key authorization.
async function removedRegistryObserver() {
  const base = scopedServer(), calls = [];
  let plan, removed = false, denial;
  const native = async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : undefined;
    calls.push({path: url.pathname, method: options.method, data});
    if (url.pathname === '/v2-beta/aiResourceViews' && removed) {
      return response({id:'context',resourceType:'project',data:[],nextMarker:null});
    }
    if (url.pathname === '/v2-beta/projects/p1/aiResourceViews' && data?.resourceType === 'registry') {
      return response({resourceType:'registry',data:[{id:'native-registry',type:'registry',accountId:'p1',state:'inactive',serverAddress:'registry.example'}]});
    }
    if (url.pathname === '/v2-beta/projects/p1/aiResourceChangePlans') {
      plan={id:'aichange-00000000-0000-4000-8000-000000000099',resourceType:'registry',operation:'remove',resourceId:'native-registry',targetPath:'Before / registry.example',
        changes:[{field:'state',before:'inactive',after:'removed'},{field:'affectedServiceCount',before:0,after:0},{field:'affectedInstanceCount',before:0,after:0},
          {field:'affectedMountCount',before:0,after:null},{field:'mountedDataRule',before:null,after:'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE'},
          {field:'affectedCredentialCount',before:1,after:1}],confirmationState:'pending',status:'preview',verifiedResult:false,expiresAt:'2030-01-01T00:00:00Z'};
      return response({...plan});
    }
    if (url.pathname.includes('/aiResourceChangePlans/')) {
      if (options.method === 'POST' && url.search === '?action=confirm') { plan.confirmationState='approved'; return response({...plan}); }
      if (options.method === 'POST' && url.search === '?action=apply') {
        removed=true; plan.status='accepted'; plan.operationId=plan.id; return response({...plan});
      }
      assert.equal(options.method,'GET');
      if (denial) return new Response(JSON.stringify({code:denial.code}),{status:denial.status,headers:{'Content-Type':'application/json'}});
      plan.status='succeeded'; plan.verifiedResult=true; return response({...plan});
    }
    return base.fetcher(url,options);
  };
  const bridge=await createBridge(bound(),{fetcher:native});
  const found=await bridge.engine.execute('find_resources',{family:'registry',resourceType:'registry'});
  assert.equal(found.status,'succeeded');
  const preview=await bridge.engine.execute('preview_resource_change',{resourceType:'registry',operation:'remove',targetRef:found.items[0].resourceRef,parameters:{}});
  assert.equal(preview.status,'needs_user');
  // The separate human Inbox owner confirms; the Bridge does not confirm.
  plan.confirmationState='approved';
  const applied=await bridge.engine.execute('apply_resource_change',{planRef:preview.planRef}); assert.equal(applied.status,'accepted');
  return {bridge,calls,applied,deny:value=>{denial=value;}};
}

test('scoped Registry remove observation survives its removed navigation witness without a second apply',async()=>{
  const f=await removedRegistryObserver();
  try {
    const afterApply=f.calls.length;
    const result=await f.bridge.engine.execute('get_operation',{operationRef:f.applied.operationRef});
    assert.equal(result.status,'succeeded'); assert.equal(result.verifiedResult,true);
    assert.equal(f.calls.slice(afterApply).some(r=>r.path==='/v2-beta/aiResourceViews'),false);
    assert.equal(f.calls.filter(r=>r.method==='POST'&&r.path.includes('/aiResourceChangePlans/')).length,1);
    assert.equal(f.calls.slice(afterApply).filter(r=>r.method==='GET'&&r.path.includes('/aiResourceChangePlans/')).length,1);
    const beforeOther=f.calls.length;
    assert.equal((await f.bridge.engine.execute('find_stacks',{query:'Other'})).code,'CONTEXT_CHANGED');
    assert.equal(f.calls.slice(beforeOther).some(r=>r.path.endsWith('/stacks')),false);
  }finally{f.bridge.close();}
});

test('removed Registry observation still rejects native revocation, scope denial and foreign receipt',async()=>{
  for (const denial of [{status:401,code:'AuthenticationRequired'},{status:403,code:'OwnerPermissionDenied'},
    {status:403,code:'KeyPolicyDenied'},{status:403,code:'ApiKeyPolicyChanged'},{status:404,code:'NotFound'}]) {
    const f=await removedRegistryObserver();
    try {
      f.deny(denial); const result=await f.bridge.engine.execute('get_operation',{operationRef:f.applied.operationRef});
      assert.notEqual(result.status,'succeeded'); assert.notEqual(result.verifiedResult,true);
      assert.equal(f.calls.filter(r=>r.method==='POST'&&r.path.includes('/aiResourceChangePlans/')).length,1);
    }finally{f.bridge.close();}
  }
});

test('removed Registry observation cannot use forged or stale operation refs',async()=>{
  const f=await removedRegistryObserver();
  try{
    let before=f.calls.length;
    assert.equal((await f.bridge.engine.execute('get_operation',{operationRef:'operation_'+'0'.repeat(48)})).code,'STALE_REFERENCE');
    assert.equal(f.calls.slice(before).some(r=>r.path.includes('/aiResourceChangePlans/')),false);
    f.bridge.engine.context.invalidate();before=f.calls.length;
    assert.notEqual((await f.bridge.engine.execute('get_operation',{operationRef:f.applied.operationRef})).status,'succeeded');
    assert.equal(f.calls.slice(before).some(r=>r.path.includes('/aiResourceChangePlans/')),false);
  }finally{f.bridge.close();}
});

test('the removed navigation allowance never applies to other valid operation references',async()=>{
  const f=await removedRegistryObserver();
  try {
    const context=f.bridge.engine.context,captured=context.capture();
    const original=context.resolve(f.applied.operationRef,'operation',captured);
    for(const changed of [{operation:'stop'},{resourceType:'service'},{planKind:'catalog-launch'}]) {
      const operationRef=context.reference('operation',{...original,...changed},captured),before=f.calls.length;
      const result=await f.bridge.engine.execute('get_operation',{operationRef});
      assert.equal(result.code,'CONTEXT_CHANGED');
      assert.equal(f.calls.slice(before).some(r=>r.path.includes('/aiResourceChangePlans/')),false);
    }
  }finally{f.bridge.close();}
});

const secret = 'secret-profile-sentinel-do-not-print';
const config = {endpoint: 'http://127.0.0.1:8888', environment: 'Before', accessKey: 'access-profile-sentinel', secretKey: secret};
const original = {id: 'p1', uuid: 'adminProject', name: 'Before', description: 'first environment', created: '2026-01-01T00:00:00Z', state: 'active'};
const bound = () => ({...config, environmentBinding: {endpoint: config.endpoint, id: original.id, uuid: original.uuid}});
const response = (value, purpose = 'ai-bridge', revision = '7') => new Response(JSON.stringify(value),
  {headers: {'Content-Type': 'application/json', 'X-PastureStack-Key-Purpose': purpose, 'X-PastureStack-Key-Revision': revision}});

test('bound bootstrap learns the current revision from one discovery before either caller reads the exact bound Project', async () => {
  for (const caller of [createBridge, prepareBoundProfile]) {
    const calls = [], current = {...original, name: 'Renamed current environment'};
    const fetcher = async (url, options) => {
      const revision = options.headers['X-PastureStack-Key-Expected-Revision'];
      calls.push({path: url.pathname, query: url.search, revision});
      assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
      if (url.pathname.endsWith('/projects')) {
        assert.equal(url.search, '?limit=1'); assert.equal(revision, undefined);
        return response({data: [], pagination: null});
      }
      assert.equal(url.pathname, '/v2-beta/projects/p1');
      // Engine only permits revisionless project collection discovery, never a single GET.
      if (revision !== '7') return new Response(JSON.stringify({code: 'ApiKeyPolicyChanged'}), {status: 403});
      return response(current);
    };
    const result = await caller(bound(), {fetcher});
    assert.deepEqual(calls, [{path: '/v2-beta/projects', query: '?limit=1', revision: undefined},
      {path: '/v2-beta/projects/p1', query: '', revision: '7'}]);
    if (caller === createBridge) {
      assert.equal(result.engine.context.capture().projectName, current.name); result.close();
    } else {
      assert.equal(result.environment, current.name); assert.deepEqual(result.environmentBinding, bound().environmentBinding);
    }
  }
});

test('bound bootstrap never selects discovery rows or follows pagination and exact ID UUID and visibility remain authoritative', async () => {
  for (const rows of [[], [original, original], [{...original, id: 'p2', uuid: 'wrong', name: 'Before'}]]) {
    const calls = [], bridge = await createBridge(bound(), {fetcher: async (url, options) => {
      calls.push(url.pathname + url.search); assert.equal(options.method, 'GET');
      return response(url.pathname.endsWith('/projects') ? {data: rows, pagination: {next: '/projects?marker=untrusted'}} : original);
    }});
    assert.equal(bridge.engine.context.capture().projectId, original.id); bridge.close();
    assert.deepEqual(calls, ['/v2-beta/projects?limit=1', '/v2-beta/projects/p1']);
  }
  for (const target of [null, [original, original], {...original, id: 'p2'}, {...original, uuid: 'replacement'}, {...original, state: 'inactive'}]) {
    const calls = [];
    await assert.rejects(createBridge(bound(), {fetcher: async (url, options) => {
      calls.push(url.pathname + url.search); assert.equal(options.method, 'GET');
      return response(url.pathname.endsWith('/projects') ? {data: []} : target);
    }}));
    assert.deepEqual(calls, ['/v2-beta/projects?limit=1', '/v2-beta/projects/p1']);
  }
});

test('bound bootstrap missing purpose revision credential and cross-revision failures stop before any business dispatch', async () => {
  for (const failure of ['discovery-denied', 'hidden', 'revision', 'missing-revision', 'purpose', 'malformed-discovery']) {
    const calls = [];
    await assert.rejects(createBridge(bound(), {fetcher: async (url, options) => {
      calls.push(url.pathname + url.search);
      if (url.pathname.endsWith('/projects')) {
        if (failure === 'discovery-denied') return new Response(JSON.stringify({code: 'Forbidden'}), {status: 403});
        if (failure === 'missing-revision') return new Response(JSON.stringify({data: [original]}), {headers: {'X-PastureStack-Key-Purpose': 'ai-bridge'}});
        if (failure === 'purpose') return response({data: [original]}, 'general');
        if (failure === 'malformed-discovery') return response({data: 'not-a-collection'});
        return response({data: [original]});
      }
      assert.equal(options.headers['X-PastureStack-Key-Expected-Revision'], '7');
      if (failure === 'hidden') return new Response(JSON.stringify({code: 'Forbidden'}), {status: 403});
      return response(original, 'ai-bridge', '8');
    }}));
    assert.equal(calls[0], '/v2-beta/projects?limit=1');
    assert.equal(calls.length, ['hidden', 'revision'].includes(failure) ? 2 : 1);
  }
  assert.equal(allowedRequest('projects?limit=1', 'GET', null, true), true);
  assert.equal(allowedRequest('projects?id=p1&limit=2', 'GET', 'p1', true), false);
});
function server(rows, requests = []) {
  return async (url, options) => {
    requests.push({path: url.pathname, method: options.method, revision: options.headers['X-PastureStack-Key-Expected-Revision']});
    if (url.pathname.endsWith('/projects')) return response({data: rows});
    if (url.pathname.endsWith('/aiToolCallEvents')) return response({accepted: true, requestId: 'event-' + requests.length});
    if (url.pathname.endsWith('/aiResourceViews')) {
      const input = JSON.parse(options.body);
      return response({resourceType: input.resourceType, data: input.resourceId ? rows.filter(row => row.id === input.resourceId) : rows, nextMarker: null});
    }
    const selected = rows.find(row => url.pathname.endsWith('/projects/' + row.id));
    if (selected) return response(selected);
    return new Response(JSON.stringify({code: 'NotFound', message: secret}), {status: 404});
  };
}
async function temporary(action) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pst-profile-source-'));
  try { await action(directory); }
  finally {
    // This flat, newly-created test directory contains no customer files/subdirectories.
    for (const name of await readdir(directory)) { const file = path.join(directory, name); await chmod(file, 0o600); await unlink(file); }
    await rmdir(directory);
  }
}

async function completedRename({failures = 0, fatal} = {}) {
  const row = {...original}, calls = [], plan = {id: 'aichange-22222222-2222-2222-2222-222222222222', resourceType: 'project', operation: 'update_metadata',
    resourceId: 'p1', targetPath: 'Untrusted stale plan label', confirmationState: 'pending', status: 'preview', verifiedResult: false,
    changes: [{field: 'name', before: 'Before', after: 'Requested label'}]};
  let completed = false, labelReads = 0, applies = 0;
  const fetcher = async (url, options) => {
    calls.push({path: url.pathname, method: options.method, search: url.search,
      event: url.pathname.endsWith('/aiToolCallEvents') ? JSON.parse(options.body) : null});
    if (url.pathname.endsWith('/aiResourceChangePlans') && options.method === 'POST') return response(plan);
    if (url.pathname.endsWith('/' + plan.id)) {
      if (options.method === 'POST') { applies++; plan.status = 'accepted'; return response(plan); }
      completed = true; row.name = 'Native authoritative name'; plan.status = 'succeeded'; plan.verifiedResult = true; return response(plan);
    }
    if (url.pathname.endsWith('/projects/p1') && completed) {
      labelReads++; assert(options.signal instanceof AbortSignal);
      assert.equal(calls.at(-2).event?.phase === 'result' || calls.at(-2).event?.phase === 'start', true);
      if (fatal === 'hidden') return new Response(JSON.stringify({code: 'NotFound', message: secret}), {status: 404});
      if (fatal === 'uuid') return response({...row, uuid: 'replacement-object'});
      if (labelReads <= failures) throw new Error(secret);
    }
    if (url.pathname.endsWith('/services')) return response({data: [{id: 's1', name: 'web', accountId: 'p1', stackId: 'st1'}]});
    if (url.pathname.endsWith('/stacks')) return response({data: [{id: 'st1', name: 'Stack', accountId: 'p1'}]});
    return server([row])(url, options);
  };
  const bridge = await createBridge(bound(), {fetcher});
  const found = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  const ref = found.items[0].resourceRef;
  const preview = await bridge.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: ref, parameters: {name: 'Requested label'}});
  assert.equal(preview.status, 'needs_user'); plan.confirmationState = 'approved'; // Separate server human approval in this source fixture.
  const submitted = await bridge.engine.execute('apply_resource_change', {planRef: preview.planRef}); assert.equal(submitted.status, 'accepted');
  const before = bridge.engine.context.capture();
  const result = await bridge.engine.execute('get_operation', {operationRef: submitted.operationRef});
  assert.equal(result.status, 'succeeded'); assert.equal(result.verifiedResult, true);
  return {bridge, calls, before, result, ref, operationRef: submitted.operationRef, labelReads: () => labelReads, applies: () => applies};
}

test('verified own rename refreshes only the native name after audit ACK without changing generation or references', async () => {
  const fixture = await completedRename(); const {bridge, before, ref, operationRef} = fixture;
  const after = bridge.engine.context.capture();
  assert.equal(after.projectName, 'Native authoritative name'); assert.equal(after.generation, before.generation);
  assert.equal(after.epoch, before.epoch); assert.equal(after.signature, before.signature); assert.equal(fixture.labelReads(), 1);
  const services = await bridge.engine.execute('find_services', {query: 'web'});
  assert.equal(services.items[0].displayPath, 'Native authoritative name/Stack/web');
  assert.equal((await bridge.engine.execute('get_resource', {resourceRef: ref})).fields.name, 'Native authoritative name');
  assert.equal((await bridge.engine.execute('get_operation', {operationRef})).status, 'succeeded');
  assert.equal(fixture.labelReads(), 1); assert.equal(fixture.applies(), 1); bridge.close();
});

test('cosmetic read failure preserves verified receipt, recovers once before next business, and never bypasses hidden/UUID failures', async () => {
  for (const failures of [1, 2]) {
    const fixture = await completedRename({failures}); assert.equal(fixture.labelReads(), 1);
    const {bridge, calls} = fixture; const mark = calls.length;
    const next = await bridge.engine.execute('find_services', {query: 'web'});
    assert.equal(fixture.labelReads(), 2);
    if (failures === 1) assert.equal(next.items[0].displayPath, 'Native authoritative name/Stack/web');
    else {
      assert.equal(next.code, 'UNKNOWN_RESULT'); assert.equal(next.reason, 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING'); assert.equal(next.retryable, true);
      assert.equal(calls.slice(mark).some(x => x.path.endsWith('/services')), false);
      assert.equal((await bridge.engine.execute('find_services', {query: 'web'})).items[0].displayPath, 'Native authoritative name/Stack/web');
      assert.equal(fixture.labelReads(), 3);
    }
    assert.equal(fixture.applies(), 1); bridge.close();
  }
  for (const [fatal, code] of [['hidden', 'FORBIDDEN'], ['uuid', 'CONTEXT_CHANGED']]) {
    const fixture = await completedRename({fatal}); const before = fixture.calls.length;
    assert.equal((await fixture.bridge.engine.execute('find_services', {query: 'web'})).code, code);
    assert.equal(fixture.calls.length, before); assert.equal(fixture.applies(), 1); fixture.bridge.close();
  }
});

test('legacy config stays unchanged; binding is closed endpoint-scoped and accepts native Default UUID', async () => {
  assert.deepEqual(validateConfig(config), config); assert.equal(validateConfig(bound()).environmentBinding.uuid, 'adminProject');
  assert(Object.isFrozen(validateConfig(bound()).environmentBinding));
  for (const patch of [{uuid: ''}, {id: '../p1'}, {endpoint: config.endpoint + '/other'}, {session: 'not-persistable'}, {uuid: 'x'.repeat(256)}]) {
    assert.throws(() => validateConfig({...bound(), environmentBinding: {...bound().environmentBinding, ...patch}}), {code: 'INVALID_ENVIRONMENT_BINDING'});
  }
  const requests = [], bridge = await createBridge(config, {fetcher: server([{...original}], requests)});
  bridge.close(); assert.equal(requests[0].path, '/v2-beta/projects'); assert.equal(Object.hasOwn(config, 'environmentBinding'), false);
  const base = 'https://example.test/platform';
  const normalized = validateConfig({...bound(), endpoint: 'https://EXAMPLE.test:443/platform/', environmentBinding: {...bound().environmentBinding, endpoint: base}});
  assert.deepEqual(validateConfig(normalized), normalized);
  assert.equal(validateConfig({...config, endpoint: 'https://example.test/platform///'}).endpoint, base);
  const calls = [], scoped = await createBridge(normalized, {fetcher: server([{...original}], calls)}); scoped.close();
  assert.deepEqual(calls.map(x => x.path), ['/platform/v2-beta/projects', '/platform/v2-beta/projects/p1']);
});

test('permanent rename then new bridge instance retains UUID despite old name reuse; old refs stay stale', async () => {
  const rows = [{...original}], firstCalls = [], first = await createBridge(bound(), {fetcher: server(rows, firstCalls)});
  const found = await first.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  assert.equal(found.status, 'succeeded'); const oldRef = found.items[0].resourceRef; first.close();
  rows[0].name = 'After'; rows.push({...original, id: 'p2', uuid: 'other-project', name: 'Before'});
  const calls = [], second = await createBridge(bound(), {fetcher: server(rows, calls)});
  assert.deepEqual(calls.map(x => x.path), ['/v2-beta/projects', '/v2-beta/projects/p1']);
  assert.equal((await second.engine.execute('get_resource', {resourceRef: oldRef})).code, 'STALE_REFERENCE');
  const fresh = await second.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  const own = fresh.items.find(x => x.fields.name === 'After'); assert(own); assert.notEqual(own.resourceRef, oldRef);
  assert.equal((await second.engine.execute('get_resource', {resourceRef: own.resourceRef})).fields.name, 'After');
  assert.equal(bound().environment, 'Before'); second.close();
});

test('bound UUID reuse, hidden target, endpoint mismatch and ordinary key never fall back to a name lookup', async () => {
  for (const rows of [[{...original, uuid: 'reused-uuid'}], [], [{...original, state: 'inactive'}]]) {
    const calls = []; await assert.rejects(createBridge(bound(), {fetcher: server(rows, calls)}));
    assert.deepEqual(calls.map(x => x.path), ['/v2-beta/projects', '/v2-beta/projects/p1']);
  }
  let calls = 0;
  await assert.rejects(createBridge({...bound(), endpoint: config.endpoint + '/different'}, {fetcher: async () => { calls++; }}), {code: 'INVALID_ENVIRONMENT_BINDING'});
  assert.equal(calls, 0);
  await assert.rejects(createBridge(bound(), {fetcher: async () => { calls++; return response(original, 'general'); }}), {code: 'DEDICATED_KEY_REQUIRED'});
  assert.equal(calls, 1);
  const paths = [];
  await assert.rejects(prepareBoundProfile(config, {fetcher: async url => { paths.push(url.pathname); return url.pathname.endsWith('/projects') ? response({data: [original]}) : response(original, 'ai-bridge', '8'); }}), {code: 'CONTEXT_CHANGED'});
  assert.deepEqual(paths, ['/v2-beta/projects', '/v2-beta/projects/p1']);
});

test('actual core preflight stays inside shared audited engine: legacy rename denied, no-op allowed, changed UUID rejected', async () => {
  for (const mode of ['legacy-rename', 'legacy-no-op', 'bound-replaced']) {
    const row = {...original}, events = []; let plans = 0;
    const fetcher = async (url, options) => {
      const input = options.body ? JSON.parse(options.body) : null;
      if (url.pathname.endsWith('/aiToolCallEvents')) { events.push(input); return response({accepted: true, requestId: 'audit-' + events.length}); }
      if (url.pathname.endsWith('/aiResourceChangePlans')) {
        plans++; return response({id: 'aichange-11111111-1111-1111-1111-111111111111', resourceType: 'project', operation: 'update_metadata',
          resourceId: 'p1', targetPath: row.name, confirmationState: 'pending', status: 'preview', verifiedResult: false,
          changes: [{field: 'description', before: row.description, after: 'new description'}]});
      }
      return server([row])(url, options);
    };
    const bridge = await createBridge(mode === 'bound-replaced' ? bound() : config, {fetcher});
    const found = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    const reference = found.items[0].resourceRef;
    if (mode === 'bound-replaced') row.uuid = 'different-server-object';
    const result = await bridge.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata', targetRef: reference,
      parameters: {name: mode === 'legacy-no-op' ? row.name : 'Renamed', description: 'new description'}});
    if (mode === 'legacy-rename') {
      assert.equal(result.code, 'NEEDS_USER'); assert.equal(result.reason, 'BRIDGE_PROJECT_BINDING_REQUIRED'); assert.equal(plans, 0);
      assert.equal(events.at(-1).phase, 'result'); assert.equal(events.at(-1).reason, 'NEEDS_USER');
    } else if (mode === 'legacy-no-op') { assert.equal(result.status, 'needs_user'); assert.equal(plans, 1); }
    else { assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(plans, 0); assert.equal(events.at(-1).reason, 'CONTEXT_CHANGED'); }
    bridge.close();
  }
});

test('writer creates a fresh private profile without changing read-only input or printing credentials/identity', async () => {
  await temporary(async directory => {
    const from = path.join(directory, 'legacy.json'), output = path.join(directory, 'bound.json'), raw = JSON.stringify(config);
    await writeFile(from, raw); await chmod(from, 0o400); let printed = '';
    const inspectInput = async () => {
      const file = await open(from, 'r');
      try {
        const raw = await file.readFile('utf8'), info = await file.stat();
        return {raw, mode: info.mode, dev: info.dev, ino: info.ino};
      } finally { await file.close(); }
    };
    const before = await inspectInput();
    assert.equal(before.mode & 0o222, 0, 'original input is not writable');
    const status = await main(['--from', from, '--output', output], {fetcher: server([{...original}]),
      write: text => { printed += text; }, error: text => { printed += text; }});
    assert.equal(status, 0); assert.equal(before.raw, raw); assert.deepEqual(await inspectInput(), before, 'reopened input preserves bytes, mode and native identity');
    const saved = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(Object.keys(saved).sort(), ['accessKey', 'endpoint', 'environment', 'environmentBinding', 'secretKey']);
    assert.deepEqual(saved.environmentBinding, {endpoint: config.endpoint, id: 'p1', uuid: 'adminProject'});
    assert.equal(saved.secretKey, secret);
    for (const value of [secret, config.accessKey, 'adminProject', 'p1']) assert.equal(printed.includes(value), false);
    let network = 0;
    assert.equal(await main(['--from', from, '--output', output], {fetcher: async () => { network++; }, write() {}, error() {}}), 1);
    assert.equal(network, 0); assert.deepEqual(await inspectInput(), before, 'collision does not replace or change the original pathname');
    assert.equal(await main(['--from', from, '--output', from], {write() {}, error() {}}), 1);
    await assert.rejects(open(output, 'wx'), error => error.code === 'EEXIST');
  });
});

test('same-name selection uses friendly labels; noninteractive, indistinguishable and cancelled choices write nothing', async () => {
  await temporary(async directory => {
    const from = path.join(directory, 'legacy.json'); await writeFile(from, JSON.stringify(config));
    const rows = [{...original}, {...original, id: 'p2', uuid: 'opaque-second', description: 'second environment', created: '2026-02-01T00:00:00Z'}];
    for (const [label, options, expected] of [
      ['noninteractive', {interactive: false}, 'AMBIGUOUS_ENVIRONMENT'],
      ['cancel', {interactive: true, choose: async () => 'q'}, 'PROFILE_BINDING_CANCELLED'],
      ['indistinguishable', {interactive: true, choose: async () => '1', fetcher: server([rows[0], {...rows[0], id: 'p2', uuid: 'opaque-second'}])}, 'AMBIGUOUS_ENVIRONMENT'],
    ]) {
      const output = path.join(directory, label + '.json');
      await assert.rejects(bindProfile({from, output}, {fetcher: server(rows), ...options}), {code: expected});
      assert.equal((await readdir(directory)).includes(label + '.json'), false);
    }
    let shown;
    const output = path.join(directory, 'selected.json');
    await bindProfile({from, output}, {interactive: true, fetcher: server(rows), choose: async labels => { shown = labels; return '2'; }});
    assert.equal(JSON.parse(await readFile(output, 'utf8')).environmentBinding.id, 'p2');
    for (const value of ['p1', 'p2', 'adminProject', 'opaque-second', secret]) assert.equal(shown.join('\n').includes(value), false);
  });
});

test('CLI has no raw-ID/force parameters; private-output failure retains source and emits no exception payload', async () => {
  for (const args of [['--id', 'p1', '--output', 'file'], ['--from', 'file', '--uuid', 'opaque'], ['--from', 'a', '--output', 'b', '--force']]) assert.throws(() => parseArguments(args), {code: 'INVALID_PROFILE_ARGUMENTS'});
  await temporary(async directory => {
    const from = path.join(directory, 'legacy.json'), output = path.join(directory, 'failed.json'); await writeFile(from, JSON.stringify(config)); let text = '';
    const status = await main(['--from', from, '--output', output], {fetcher: server([{...original}]), secureFile: async () => { throw new Error(secret); },
      write: value => { text += value; }, error: value => { text += value; }});
    assert.equal(status, 1); assert.equal(text.includes(secret), false); assert.equal((await readdir(directory)).includes('failed.json'), false);
    assert.deepEqual(JSON.parse(await readFile(from, 'utf8')), config);
  });
});

test('shared discovery requests native all visibility, keeps paging and rechecks exact Key permission', async () => {
  const target = {...original, id: 'p2', uuid: 'nonmember-project', name: 'Nonmember'};
  for (const role of ['admin', 'member', 'denied-key']) {
    const calls = [], fetcher = async (url, options) => {
      calls.push({path: url.pathname, query: url.search, revision: options.headers['X-PastureStack-Key-Expected-Revision']});
      if (url.pathname === '/v2-beta/aiResourceViews') {
        assert.equal(role, 'member');
        assert.deepEqual(JSON.parse(options.body), {resourceType: 'project', view: 'bridge_context', query: target.name});
        return response({id: 'aiview-member', resourceType: 'project', data: [], nextMarker: null});
      }
      if (url.pathname.endsWith('/projects')) {
        assert.equal(url.searchParams.get('all'), 'true'); assert.equal(url.searchParams.getAll('all').length, 1);
        if (role === 'member') return response({data: [original]}); // Native policy ignores all=true for non-admin.
        if (!url.searchParams.has('marker')) return response({data: [original], pagination: {next: config.endpoint + '/v2-beta/projects?limit=100&marker=next'}});
        return response({data: [target]});
      }
      assert.equal(url.pathname, '/v2-beta/projects/p2'); assert.equal(options.headers['X-PastureStack-Key-Expected-Revision'], '7');
      if (role === 'denied-key') return new Response(JSON.stringify({code: 'PermissionDenied'}), {status: 403});
      return response(target);
    };
    if (role === 'admin') {
      const result = await prepareBoundProfile({...config, environment: target.name}, {fetcher});
      assert.deepEqual(result.environmentBinding, {endpoint: config.endpoint, id: target.id, uuid: target.uuid});
      assert.equal(calls.length, 3);
    } else if (role === 'member') await assert.rejects(prepareBoundProfile({...config, environment: target.name}, {fetcher}), {code: 'ENVIRONMENT_NOT_VISIBLE'});
    else await assert.rejects(prepareBoundProfile({...config, environment: target.name}, {fetcher}), error => error.status === 403);
  }
  const calls = [], legacy = await createBridge(config, {fetcher: async url => { calls.push(url.pathname + url.search); return response({data: [original]}); }});
  legacy.close(); assert.deepEqual(calls, ['/v2-beta/projects?limit=100&all=true']);
  assert.throws(() => validateConfig({...config, isAdmin: true}), {code: 'INVALID_CONFIG'});
});

test('all query is one literal true on bootstrap collection GET only; pagination rejects other values', async () => {
  assert.equal(allowedRequest('projects?limit=100&all=true', 'GET', null, true), true);
  for (const query of ['all=false', 'all=True', 'all=1', 'all=', 'all=true&all=true', 'all=true&all=false']) {
    assert.equal(allowedRequest('projects?' + query, 'GET', null, true), false);
  }
  assert.equal(allowedRequest('projects?all=true', 'GET', 'p1', false), false);
  assert.equal(allowedRequest('projects/p1?all=true', 'GET', 'p1', true), false);
  assert.equal(allowedRequest('projects?all=true', 'POST', 'p1', true), false);
  let calls = 0;
  await assert.rejects(createBridge(config, {fetcher: async () => { calls++; return response({data: [original], pagination: {next: config.endpoint + '/v2-beta/projects?all=false&marker=next'}}); }}),
    {code: 'INVALID_ENVIRONMENT_PAGE'});
  assert.equal(calls, 1);
});


test('legacy native all visibility selects a nonmember admin Project across pages', async () => {
  const target = {...original, id: 'p2', uuid: 'native-nonmember-project', name: 'Nonmember'};
  const calls = [], bridge = await createBridge({...config, environment: target.name}, {fetcher: async (url, options) => {
    calls.push({path: url.pathname, all: url.searchParams.getAll('all'), revision: options.headers['X-PastureStack-Key-Expected-Revision']});
    assert.equal(url.origin, config.endpoint); assert.equal(url.pathname, '/v2-beta/projects');
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(config.accessKey + ':' + secret).toString('base64'));
    assert.equal('Cookie' in options.headers, false);
    // The native admin collection needs all=true; direct access alone does not
    // put this Project in the caller's ordinary member-only collection.
    if (url.searchParams.get('all') !== 'true') return response({data: [original]});
    if (!url.searchParams.has('marker')) return response({data: [original], pagination: {next: config.endpoint + '/v2-beta/projects?limit=100&marker=next'}});
    return response({data: [target]});
  }});
  try {
    assert.equal(bridge.engine.context.capture().projectId, target.id);
    assert.deepEqual(calls, [{path: '/v2-beta/projects', all: ['true'], revision: undefined},
      {path: '/v2-beta/projects', all: ['true'], revision: '7'}]);
  } finally { bridge.close(); }
});

test('legacy native all visibility cannot broaden account or Key visibility or choose an absent or ambiguous target', async () => {
  const target = {...original, id: 'p2', uuid: 'native-nonmember-project', name: 'Nonmember'};
  for (const role of ['nonadmin', 'noaccess', 'restricted-key', 'empty', 'ambiguous']) {
    let calls = 0;
    await assert.rejects(createBridge({...config, environment: target.name}, {fetcher: async (url, options) => {
      calls++;
      if (url.pathname === '/v2-beta/aiResourceViews') {
        assert.deepEqual(JSON.parse(options.body), {resourceType: 'project', view: 'bridge_context', query: target.name});
        return response({id: 'aiview-hidden', resourceType: 'project', data: [], nextMarker: null});
      }
      assert.deepEqual(url.searchParams.getAll('all'), ['true']);
      if (role === 'noaccess') return new Response(JSON.stringify({code: 'PermissionDenied', message: secret}), {status: 403});
      // all=true is only a native listing option. The server still applies the
      // actual principal/Key policy; the bridge never synthesizes hidden rows.
      return response({data: role === 'empty' ? [] : role === 'ambiguous' ? [target, {...target, id: 'p3'}] : [original]});
    }}), error => {
      assert.equal(JSON.stringify(error).includes(secret), false);
      return role === 'noaccess' ? error.status === 403 : error.code === (role === 'ambiguous' ? 'AMBIGUOUS_ENVIRONMENT' : 'ENVIRONMENT_NOT_VISIBLE');
    });
    assert.equal(calls, ['nonadmin', 'restricted-key', 'empty'].includes(role) ? 2 : 1);
  }
});

test('legacy native all visibility retains the page limit and rejects unsafe pagination', async () => {
  let calls = 0;
  await assert.rejects(createBridge(config, {fetcher: async url => {
    calls++; assert.deepEqual(url.searchParams.getAll('all'), ['true']);
    return response({data: [], pagination: {next: config.endpoint + '/v2-beta/projects?marker=' + calls}});
  }}), {code: 'ENVIRONMENT_SCAN_LIMIT'});
  assert.equal(calls, 20);
  for (const next of ['https://other.test/v2-beta/projects?marker=next',
    config.endpoint + '/v2-beta/projects?all=false&marker=next',
    config.endpoint + '/v2-beta/projects?all=true&all=true&marker=next',
    config.endpoint + '/v2-beta/projects/p2?marker=next']) {
    calls = 0;
    await assert.rejects(createBridge(config, {fetcher: async () => {
      calls++; return response({data: [], pagination: {next}});
    }}), {code: 'INVALID_ENVIRONMENT_PAGE'});
    assert.equal(calls, 1);
  }
});

test('legacy native all visibility still requires dedicated purpose and one verified Key revision', async () => {
  await assert.rejects(createBridge(config, {fetcher: async () => response({data: [original]}, 'general')}), {code: 'DEDICATED_KEY_REQUIRED'});
  let calls = 0;
  await assert.rejects(createBridge(config, {fetcher: async (url, options) => {
    calls++;
    if (calls === 1) return response({data: [], pagination: {next: config.endpoint + '/v2-beta/projects?marker=next'}}, 'ai-bridge', '7');
    assert.equal(options.headers['X-PastureStack-Key-Expected-Revision'], '7');
    return response({data: [original]}, 'ai-bridge', '8');
  }}), {code: 'CONTEXT_CHANGED'});
  assert.equal(calls, 2);
});

test('writer claims a private exclusive output before config or network and cleans only its failed empty file', async () => {
  await temporary(async directory => {
    const from = path.join(directory, 'missing-private-profile.json'), output = path.join(directory, 'new-bound.json'),
      collision = path.join(directory, 'existing-bound.json');
    let protectedEmpty = 0, network = 0, message = '';
    const options = {fetcher: async () => { network++; throw new Error('must not fetch'); },
      secureFile: async file => { assert.equal((await file.stat()).size, 0); protectedEmpty++; },
      write() {}, error: text => { message = text; }};
    assert.equal(await main(['--from', from, '--output', output], options), 1);
    assert.match(message, /CONFIG_UNREADABLE/); assert.equal(protectedEmpty, 1); assert.equal(network, 0);
    await writeFile(collision, 'original-owned-sentinel', {flag: 'wx', mode: 0o600});
    const inspectCollision = async () => {
      const file = await open(collision, 'r');
      try {
        const raw = await file.readFile('utf8'), info = await file.stat();
        return {raw, mode: info.mode, dev: info.dev, ino: info.ino};
      } finally { await file.close(); }
    };
    const before = await inspectCollision();
    assert.equal(await main(['--from', from, '--output', collision], options), 1);
    assert.match(message, /PROFILE_OUTPUT_EXISTS/); assert.equal(protectedEmpty, 1); assert.equal(network, 0);
    assert.equal(before.raw, 'original-owned-sentinel');
    assert.deepEqual(await inspectCollision(), before, 'fresh pathname FD retains original bytes, permissions and native identity');
    await assert.rejects(open(output, 'r'), error => error.code === 'ENOENT');
  });
});

function identityRow(row = original) {
  return {id: row.id, uuid: row.uuid, name: row.name, state: row.state};
}

function contextEnvelope(rows) {
  // AiResourceViewResourceManager returns ResourceImpl, not the service Map.
  return {id: 'aiview-11111111-1111-1111-1111-111111111111', type: 'aiResourceView', baseType: 'aiResourceView',
    links: {self: config.endpoint + '/v2-beta/aiResourceViews/aiview-11111111-1111-1111-1111-111111111111'}, actions: {},
    resourceType: 'project', data: rows, nextMarker: null};
}

function scopedServer() {
  const calls = [], state = {rows: [identityRow()], projectError: {status: 403, code: 'KeyScopeDenied'}};
  const fetcher = async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : undefined;
    calls.push({path: url.pathname, method: options.method, data,
      revision: options.headers['X-PastureStack-Key-Expected-Revision']});
    if (url.pathname.endsWith('/projects')) return response({data: []});
    if (url.pathname.endsWith('/projects/p1')) {
      return state.projectError ? new Response(JSON.stringify({code: state.projectError.code, message: secret}), {status: state.projectError.status}) :
        response(state.rows[0]);
    }
    if (url.pathname.endsWith('/v2-beta/aiResourceViews')) {
      assert.equal(options.headers['X-PastureStack-Key-Expected-Revision'], '7');
      if (state.contextError) return new Response(JSON.stringify({code: state.contextError, message: secret}), {status: 403});
      const rows = state.overrideRows || state.rows.filter(row => data.resourceId ? row.id === data.resourceId : row.name === data.query);
      const envelope = contextEnvelope(rows);
      return response(state.contextBody ? state.contextBody(envelope) : envelope,
        'ai-bridge', state.contextRevision || '7');
    }
    if (url.pathname.endsWith('/aiToolCallEvents')) return response({accepted: true, requestId: 'event-' + calls.length});
    if (url.pathname.endsWith('/stacks')) return response({data: [{id: 'st1', name: 'Own Stack', accountId: 'p1'}]});
    if (url.pathname.endsWith('/aiResourceViews')) return new Response(JSON.stringify({code: 'KeyScopeDenied', message: secret}), {status: 403});
    throw new Error('unexpected scoped bridge request');
  };
  return {calls, state, fetcher};
}

test('scoped environment identity accepts native ResourceImpl and bare DTO envelopes without following metadata', async () => {
  for (const caller of [createBridge, prepareBoundProfile]) {
    for (const shape of ['native', 'bare']) {
      const f = scopedServer(), origins = [];
      f.state.contextBody = body => {
        if (shape === 'bare') return {id: body.id, resourceType: body.resourceType, data: body.data, nextMarker: body.nextMarker};
        return {...body, links: {self: 'https://metadata.invalid/not-an-environment'},
          actions: {remove: 'https://metadata.invalid/not-an-authorized-action'}};
      };
      const result = await caller(bound(), {fetcher: (url, options) => { origins.push(url.origin); return f.fetcher(url, options); }});
      if (caller === createBridge) {
        assert.equal(result.engine.context.capture().projectId, original.id); result.close();
      } else {
        assert.deepEqual(result.environmentBinding, bound().environmentBinding);
      }
      assert.deepEqual(origins, Array(origins.length).fill(config.endpoint));
      assert.equal(f.calls.some(row => /apply|confirm|action=|not-an-/.test(row.path)), false);
      assert.deepEqual(f.calls.at(-1).data, {resourceType: 'project', view: 'bridge_context', resourceId: original.id});
    }
  }
});

test('scoped environment identity rejects malformed native metadata and keeps business DTO bounds closed', async () => {
  const invalid = [body => ({...body, type: 'project'}), body => ({...body, baseType: 'aiResourceChangePlan'}),
    body => ({...body, authorized: true}), body => { const result = {...body}; delete result.type; return result; },
    body => ({...body, links: null}), body => ({...body, links: []}), body => ({...body, actions: 'remove'}),
    body => ({...body, links: {self: 42}}), body => ({...body, links: {self: 'javascript:alert(1)'}}),
    body => ({...body, links: {self: 'https://account:secret@metadata.invalid/'}}),
    body => ({...body, actions: Object.fromEntries(Array.from({length: 17}, (_, i) => ['action' + i, 'https://metadata.invalid/']))}),
    body => ({...body, id: 'bad\nidentity'}), body => ({...body, resourceType: 'stack'}),
    body => ({...body, nextMarker: 'another-page'}), body => ({...body, data: Array.from({length: 51}, () => identityRow())}),
    body => ({...body, data: [{...identityRow(), description: 'not authorized by this projection'}]})];
  for (const change of invalid) {
    const f = scopedServer(); f.state.contextBody = change;
    await assert.rejects(createBridge(bound(), {fetcher: f.fetcher}), {code: 'INVALID_ENVIRONMENT_RESPONSE'});
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls.some(row => /stacks|apply|confirm|action=/.test(row.path)), false);
  }
});

test('scoped bound environment identity falls back only after exact Project scope denial and keeps business reads separate', async () => {
  const f = scopedServer(), bridge = await createBridge(bound(), {fetcher: f.fetcher});
  try {
    assert.deepEqual(f.calls.map(row => row.path), ['/v2-beta/projects', '/v2-beta/projects/p1', '/v2-beta/aiResourceViews']);
    assert.deepEqual(f.calls[2].data, {resourceType: 'project', view: 'bridge_context', resourceId: 'p1'});
    assert.deepEqual(f.calls.map(row => row.revision), [undefined, '7', '7']);
    const found = await bridge.engine.execute('find_stacks', {query: 'Own Stack'});
    assert.equal(found.status, 'succeeded'); assert.ok(found.items[0].stackRef);
    const before = f.calls.filter(row => row.path === '/v2-beta/aiResourceViews').length;
    const denied = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    assert.equal(denied.code, 'FORBIDDEN');
    assert.equal(f.calls.filter(row => row.path === '/v2-beta/aiResourceViews').length, before + 1, 'only the private preflight reads an identity');
    assert.equal(f.calls.at(-2).path, '/v2-beta/projects/p1/aiResourceViews', 'the ordinary business denial is not retried through the identity view');
    assert.equal(bridge.tools.length, 12); assert.equal(JSON.stringify(denied).includes(secret), false);
    assert.deepEqual(bridge.tools.find(tool => tool.name === 'get_resource').inputSchema.properties.view.enum, ['stack_graph', 'container_logs']);
    assert.equal(f.calls.some(row => /apply|confirm|action=/.test(row.path)), false);
  } finally { bridge.close(); }
});

test('scoped name discovery pins the first server UUID and prepares an exact binding without model IDs', async () => {
  const f = scopedServer(), bridge = await createBridge(config, {fetcher: f.fetcher});
  try {
    assert.deepEqual(f.calls.map(row => row.path), ['/v2-beta/projects', '/v2-beta/aiResourceViews']);
    assert.deepEqual(f.calls[1].data, {resourceType: 'project', view: 'bridge_context', query: config.environment});
    assert.equal(bridge.engine.context.capture().projectId, original.id);
    f.state.rows[0].uuid = 'replacement-server-identity';
    const result = await bridge.engine.execute('find_stacks', {query: 'Own Stack'});
    assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(f.calls.some(row => row.path.endsWith('/stacks')), false);
  } finally { bridge.close(); }
  const prepared = scopedServer(), result = await prepareBoundProfile(config, {fetcher: prepared.fetcher});
  assert.deepEqual(result.environmentBinding, bound().environmentBinding);
  assert.deepEqual(prepared.calls.filter(row => row.path === '/v2-beta/aiResourceViews').map(row => row.data), [
    {resourceType: 'project', view: 'bridge_context', query: config.environment},
    {resourceType: 'project', view: 'bridge_context', resourceId: original.id}]);
  assert.equal(Object.hasOwn(config, 'environmentBinding'), false);
});

test('scoped same-name identities never use a guessed selection and exact-name drift stays closed', async () => {
  for (const caller of [createBridge, prepareBoundProfile]) {
    const f = scopedServer(); f.state.rows.push({...identityRow(), id: 'p2', uuid: 'another-server-identity'});
    let chosen = 0;
    await assert.rejects(caller(config, {fetcher: f.fetcher, select: async () => { chosen++; return 0; }}), {code: 'AMBIGUOUS_ENVIRONMENT'});
    assert.equal(chosen, 0); assert.equal(f.calls.length, 2);
  }
  for (const rows of [[{...identityRow(), name: 'before'}], [{...identityRow(), name: 'Before '}],
    [identityRow(), identityRow()], [{...identityRow(), description: 'not part of this projection'}]]) {
    const f = scopedServer(); f.state.overrideRows = rows;
    await assert.rejects(createBridge(config, {fetcher: f.fetcher}), {code: 'INVALID_ENVIRONMENT_RESPONSE'});
    assert.equal(f.calls.some(row => row.path.endsWith('/stacks')), false);
  }
});

test('environment identity fallback cannot absorb authentication policy owner revision or UUID failures', async () => {
  for (const [status, code] of [[401, 'AuthenticationRequired'], [403, 'ApiKeyRevoked'], [403, 'ApiKeyPolicyChanged'],
    [403, 'KeyPolicyDenied'], [403, 'OwnerPermissionDenied'], [403, 'PermissionDenied'], [404, 'NotFound']]) {
    const f = scopedServer(); f.state.projectError = {status, code};
    await assert.rejects(createBridge(bound(), {fetcher: f.fetcher}), error => error.status === status && error.body.code === code);
    assert.equal(f.calls.length, 2); assert.equal(f.calls.some(row => row.path === '/v2-beta/aiResourceViews'), false);
  }
  for (const mode of ['native-uuid', 'context-uuid', 'missing-uuid', 'inactive', 'context-revision', 'context-denied', 'context-empty']) {
    const f = scopedServer();
    if (mode === 'native-uuid') f.state.projectError = null;
    if (mode.endsWith('uuid')) f.state.rows[0].uuid = mode === 'missing-uuid' ? undefined : 'reused-object';
    if (mode === 'inactive') f.state.rows[0].state = 'inactive';
    if (mode === 'context-revision') f.state.contextRevision = '8';
    if (mode === 'context-denied') f.state.contextError = 'KeyPolicyDenied';
    if (mode === 'context-empty') f.state.rows = [];
    await assert.rejects(createBridge(bound(), {fetcher: f.fetcher}), error => mode === 'context-denied' ?
      error.status === 403 && error.body.code === 'KeyPolicyDenied' :
      error.code === (mode === 'context-revision' ? 'CONTEXT_CHANGED' : mode === 'missing-uuid' ?
        'INVALID_ENVIRONMENT_RESPONSE' : 'ENVIRONMENT_BINDING_MISMATCH'));
    assert.equal(f.calls.length, mode === 'native-uuid' ? 2 : 3);
  }
  for (const code of ['ApiKeyRevoked', 'ApiKeyPolicyChanged', 'OwnerPermissionDenied', 'KeyPolicyDenied']) {
    const f = scopedServer(), bridge = await createBridge(bound(), {fetcher: f.fetcher});
    try {
      f.state.contextError = code;
      const result = await bridge.engine.execute('find_stacks', {query: 'Own Stack'});
      assert.equal(result.code, 'FORBIDDEN'); assert.equal(f.calls.some(row => row.path.endsWith('/stacks')), false);
      assert.equal(JSON.stringify(result).includes(secret), false);
    } finally { bridge.close(); }
  }
});

test('private global environment identity transport requires a learned revision and closed selectors', async () => {
  let calls = 0;
  const request = createTransport(config, async () => { calls++; return response({data: []}); });
  const data = {resourceType: 'project', view: 'bridge_context', resourceId: 'p1'};
  assert.equal(allowedRequest('aiResourceViews', 'POST', null, true), true);
  for (const [url, method, bootstrap] of [['aiResourceViews', 'POST', false], ['aiResourceViews', 'GET', true],
    ['aiResourceViews?view=bridge_context', 'POST', true], ['../aiResourceViews', 'POST', true]]) {
    assert.equal(allowedRequest(url, method, null, bootstrap), false);
  }
  await assert.rejects(request({url: 'aiResourceViews', method: 'POST', data}, null, true), {code: 'FORBIDDEN'});
  assert.equal(calls, 0); await request({url: 'projects?limit=1'}, null, true);
  for (const patch of [{resourceType: 'stack'}, {view: 'stack_graph'}, {query: 'Before'}, {resourceId: '../p1'},
    {expectedUUID: 'adminProject'}, {marker: 'p1'}, {sourcePage: {}}, {parentId: 'p1'}, {url: '/projects/p1'}]) {
    await assert.rejects(request({url: 'aiResourceViews', method: 'POST', data: {...data, ...patch}}, null, true), {code: 'FORBIDDEN'});
  }
  assert.equal(calls, 1); await request({url: 'aiResourceViews', method: 'POST', data}, null, true); assert.equal(calls, 2);
});

test('legacy startup pins its first server UUID before an exact project preflight can create a plan', async () => {
  const row = {...original}, requests = []; let plans = 0;
  const bridge = await createBridge(config, {fetcher: async (url, options) => {
    requests.push(url.pathname);
    if (url.pathname.endsWith('/aiResourceChangePlans')) { plans++; throw new Error('must not create a plan'); }
    return server([row])(url, options);
  }});
  try {
    assert.deepEqual(requests, ['/v2-beta/projects']);
    const found = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    row.uuid = 'replaced-after-name-discovery';
    const result = await bridge.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata',
      targetRef: found.items[0].resourceRef, parameters: {name: row.name}});
    assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(plans, 0);
  } finally { bridge.close(); }
  const missing = {...original}; delete missing.uuid;
  await assert.rejects(createBridge(config, {fetcher: server([missing])}), {code: 'ENVIRONMENT_IDENTITY_UNAVAILABLE'});
});
