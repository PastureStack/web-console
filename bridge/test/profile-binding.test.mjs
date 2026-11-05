import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, chmod, stat, readdir, unlink, rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBridge, validateConfig, prepareBoundProfile, allowedRequest} from '../core.mjs';
import {bindProfile, main, parseArguments} from '../bind-profile.mjs';

const secret = 'secret-profile-sentinel-do-not-print';
const config = {endpoint: 'http://127.0.0.1:8888', environment: 'Before', accessKey: 'access-profile-sentinel', secretKey: secret};
const original = {id: 'p1', uuid: 'adminProject', name: 'Before', description: 'first environment', created: '2026-01-01T00:00:00Z', state: 'active'};
const bound = () => ({...config, environmentBinding: {endpoint: config.endpoint, id: original.id, uuid: original.uuid}});
const response = (value, purpose = 'ai-bridge', revision = '7') => new Response(JSON.stringify(value),
  {headers: {'Content-Type': 'application/json', 'X-PastureStack-Key-Purpose': purpose, 'X-PastureStack-Key-Revision': revision}});
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
  assert.equal(calls[0].path, '/platform/v2-beta/projects/p1');
});

test('permanent rename then new bridge instance retains UUID despite old name reuse; old refs stay stale', async () => {
  const rows = [{...original}], firstCalls = [], first = await createBridge(bound(), {fetcher: server(rows, firstCalls)});
  const found = await first.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  assert.equal(found.status, 'succeeded'); const oldRef = found.items[0].resourceRef; first.close();
  rows[0].name = 'After'; rows.push({...original, id: 'p2', uuid: 'other-project', name: 'Before'});
  const calls = [], second = await createBridge(bound(), {fetcher: server(rows, calls)});
  assert.deepEqual(calls.map(x => x.path), ['/v2-beta/projects/p1']);
  assert.equal((await second.engine.execute('get_resource', {resourceRef: oldRef})).code, 'STALE_REFERENCE');
  const fresh = await second.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
  const own = fresh.items.find(x => x.fields.name === 'After'); assert(own); assert.notEqual(own.resourceRef, oldRef);
  assert.equal((await second.engine.execute('get_resource', {resourceRef: own.resourceRef})).fields.name, 'After');
  assert.equal(bound().environment, 'Before'); second.close();
});

test('bound UUID reuse, hidden target, endpoint mismatch and ordinary key never fall back to a name lookup', async () => {
  for (const rows of [[{...original, uuid: 'reused-uuid'}], [], [{...original, state: 'inactive'}]]) {
    const calls = []; await assert.rejects(createBridge(bound(), {fetcher: server(rows, calls)}));
    assert.deepEqual(calls.map(x => x.path), ['/v2-beta/projects/p1']);
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
    await writeFile(from, raw); await chmod(from, 0o400); const beforeMode = (await stat(from)).mode; let printed = '';
    const status = await main(['--from', from, '--output', output], {fetcher: server([{...original}]),
      write: text => { printed += text; }, error: text => { printed += text; }});
    assert.equal(status, 0); assert.equal(await readFile(from, 'utf8'), raw); assert.equal((await stat(from)).mode, beforeMode);
    const saved = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(Object.keys(saved).sort(), ['accessKey', 'endpoint', 'environment', 'environmentBinding', 'secretKey']);
    assert.deepEqual(saved.environmentBinding, {endpoint: config.endpoint, id: 'p1', uuid: 'adminProject'});
    assert.equal(saved.secretKey, secret);
    for (const value of [secret, config.accessKey, 'adminProject', 'p1']) assert.equal(printed.includes(value), false);
    let network = 0;
    assert.equal(await main(['--from', from, '--output', output], {fetcher: async () => { network++; }, write() {}, error() {}}), 1);
    assert.equal(network, 0); assert.equal(await readFile(from, 'utf8'), raw);
    assert.equal(await main(['--from', from, '--output', from], {write() {}, error() {}}), 1);
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

test('explicit writer alone requests native all visibility, keeps paging and rechecks exact Key permission', async () => {
  const target = {...original, id: 'p2', uuid: 'nonmember-project', name: 'Nonmember'};
  for (const role of ['admin', 'member', 'denied-key']) {
    const calls = [], fetcher = async (url, options) => {
      calls.push({path: url.pathname, query: url.search, revision: options.headers['X-PastureStack-Key-Expected-Revision']});
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
  legacy.close(); assert.deepEqual(calls, ['/v2-beta/projects?limit=100']);
  assert.throws(() => validateConfig({...config, isAdmin: true}), {code: 'INVALID_CONFIG'});
});

test('all query is one literal true on bootstrap collection GET only; legacy paging cannot opt in', async () => {
  assert.equal(allowedRequest('projects?limit=100&all=true', 'GET', null, true), true);
  for (const query of ['all=false', 'all=True', 'all=1', 'all=', 'all=true&all=true', 'all=true&all=false']) {
    assert.equal(allowedRequest('projects?' + query, 'GET', null, true), false);
  }
  assert.equal(allowedRequest('projects?all=true', 'GET', 'p1', false), false);
  assert.equal(allowedRequest('projects/p1?all=true', 'GET', 'p1', true), false);
  assert.equal(allowedRequest('projects?all=true', 'POST', 'p1', true), false);
  let calls = 0;
  await assert.rejects(createBridge(config, {fetcher: async () => { calls++; return response({data: [original], pagination: {next: config.endpoint + '/v2-beta/projects?all=true&marker=next'}}); }}),
    {code: 'INVALID_ENVIRONMENT_PAGE'});
  assert.equal(calls, 1);
});
