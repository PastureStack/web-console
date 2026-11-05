import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import test from 'node:test';

const C = {AUTH_SESSION: {STORAGE_KEY: 'session', LOCK_NAME: 'auth-lock', LOCK_DATABASE: 'auth-db', LOGOUT_HEADER: 'X-PastureStack-Client-Session-Id'}, SESSION: {IDENTITY: 'identity'}, COOKIE: {TOKEN: 'token'}, HEADER: {USER_ID: 'X-Api-User-Id'}, TOKEN_TO_SESSION_KEYS: []};
const initialGeneration = '1762362000000.' + 'a'.repeat(64);
const barrierIterations = 100;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return {promise, resolve}; };
const settle = async () => { for (let i = 0; i < 100; i++) { await Promise.resolve(); } };
const sources = ['auth-session', 'access'].map((name) => readFileSync(new URL(`../app/services/${name}.js`, import.meta.url), 'utf8'));
const tar = gunzipSync(readFileSync(new URL('../vendor/ember-api-store-compat/ember-api-store-2.8.5-pasturestack.8.tgz', import.meta.url)));
let fetchSource;
for (let at = 0; at + 512 <= tar.length;) {
  const name = tar.subarray(at, at + 100).toString().replace(/\0.*$/, '');
  const size = parseInt(tar.subarray(at + 124, at + 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
  if (name === 'package/addon/utils/fetch.js') { fetchSource = tar.subarray(at + 512, at + 512 + size).toString(); break; }
  at += 512 + Math.ceil(size / 512) * 512;
}
assert.ok(fetchSource, 'use the exact locked vendor Fetch adapter');

function fixture() {
  const shared = new Map([['session', JSON.stringify({generation: initialGeneration, accountId: '1a1', committedAt: 1762362000000})]]);
  const jar = {value: 'private-old-cookie'};
  const clock = {now: 1762362000000};
  const database = {row: null, queue: [], active: null, dropNextCompletion: false, dropped: false};
  database.db = {transaction(store, mode) {
    assert.equal(store, 'locks');
    const ops = [];
    const tx = {mode, objectStore: () => ({get() { const req = {}; ops.push(() => { req.result = database.row ? {...database.row} : undefined; req.onsuccess?.(); }); return req; }, put(value) { database.row = {...value}; }, delete() { database.row = null; } }), abort() { tx.aborted = true; }};
    database.queue.push({tx, ops});
    queueMicrotask(pump);
    return tx;
  }};
  function pump() {
    if (database.active || !database.queue.length) { return; }
    const job = database.active = database.queue.shift();
    queueMicrotask(() => {
      for (const op of job.ops) { if (!job.tx.aborted) { op(); } }
      queueMicrotask(() => {
        database.active = null;
        if (database.dropNextCompletion) { database.dropNextCompletion = false; database.dropped = true; }
        else if (job.tx.aborted) { job.tx.onabort?.(); }
        else { job.tx.oncomplete?.(); }
        pump();
      });
    });
  }
  function page({deferToken, deleteResponse, anonymous = false, invalidActor = false} = {}) {
    const timers = new Map(); let timer = 0;
    const calls = [];
    const window = {location: {protocol: 'http:'}, navigator: {}, crypto: webcrypto, localStorage: {getItem: (key) => shared.get(key) || null, setItem: (key, value) => shared.set(key, value), removeItem: (key) => shared.delete(key)}, indexedDB: {open() { const request = {}; queueMicrotask(() => { request.result = database.db; request.onsuccess?.(); }); return request; }}, setTimeout(fn, ms) { timers.set(++timer, {fn, at: clock.now + ms, interval: 0}); return timer; }, setInterval(fn, ms) { timers.set(++timer, {fn, at: clock.now + ms, interval: ms}); return timer; }, clearInterval: (id) => timers.delete(id)};
    class VirtualDate extends Date { static now() { return clock.now; } }
    const sandbox = {window, Date: VirtualDate, Uint8Array, Promise, reject: (value) => Promise.reject(value), resolve: (value) => Promise.resolve(value), Service: {extend: (...args) => args.at(-1)}, service: () => null, Evented: {}, run: (fn) => fn(), C};
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i].replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*\};\r?\n/gm, '').replace('export default Service.extend', `globalThis.${i === 0 ? 'Auth' : 'Access'} = Service.extend`);
      vm.runInNewContext('Function.prototype.property=function(){return this;};\n' + source, sandbox, {filename: i === 0 ? 'auth-session.js' : 'access.js'});
    }
    const instance = (definition) => Object.assign(Object.create(definition), {get(key) { return key.split('.').reduce((value, part) => value?.[part], this); }, set(key, value) { this[key] = value; return value; }, setProperties(values) { Object.assign(this, values); }});
    const auth = instance(sandbox.Auth); auth.lockManager = null;
    const access = instance(sandbox.Access); access.authSession = auth;
    access.cookies = {get: () => jar.value, remove: () => { jar.value = null; }, setWithOptions(name, value) { jar.value = value; return true; }};
    access.session = {get: () => undefined, setProperties: () => {}};
    const transport = {reject: (value) => Promise.reject(value), _fetch: async (url, opt) => {
      assert.ok(['token', '', 'token/current'].includes(url)); calls.push({url, opt});
      const captured = opt.headers?.Authorization?.replace(/^Bearer /, '') || jar.value;
      if (url === 'token' && deferToken) { await deferToken.promise; }
      if (opt.method === 'DELETE' && deleteResponse) { await deleteResponse.promise; }
      // Browser credentials semantics at the unit boundary: late credentials-
      // carrying responses apply Set-Cookie; omit responses cannot rewrite it.
      if (opt.credentials !== 'omit' && opt.method !== 'DELETE') { jar.value = captured; }
      const body = url === 'token' ? {data: [anonymous ? {accountId: null, user: null, userIdentity: null} : {userIdentity: {externalId: 'owner', externalIdType: 'provider'}}]} : {};
      return {status: 200, ok: true, headers: {get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : name === C.HEADER.USER_ID ? invalidActor ? '' : '1a1' : null}, text: async () => JSON.stringify(body)};
    }};
    const source = fetchSource.replace(/^import .*\r?\n/gm, '').replace('export function fetch', 'function fetch').replace('export default fetch;', 'globalThis.adapter=fetch;');
    vm.runInNewContext(source, transport, {filename: 'actual-locked-fetch.js'});
    access.userStore = {rawRequest: (opt) => transport.adapter(opt.url, opt)};
    return {auth, access, calls, terminate: () => timers.clear(), async tick(ms) { clock.now += ms; for (const [id, value] of [...timers]) { if (value.at <= clock.now) { timers.delete(id); value.fn(); if (value.interval) { timers.set(id, {...value, at: clock.now + value.interval}); } } } await settle(); }};
  }
  return {page, shared, jar, database, clock};
}

test('reload after a passive transaction commit cannot leave an orphan lease', async () => {
 for (let iteration = 0; iteration < barrierIterations; iteration++) {
  const f = fixture(), old = f.page();
  f.database.dropNextCompletion = true;
  old.access.ensureSession();
  await settle();
  assert.equal(f.database.dropped, true);
  assert.equal(f.database.row, null);
  old.terminate();
  const fresh = f.page();
  await fresh.access.ensureSession();
  assert.equal(f.clock.now, 1762362000000, 'no clock advance or retry/TTL shortcut');
  assert.equal(fresh.auth.tabGeneration, initialGeneration);
  assert.equal(fresh.auth.accountId, '1a1');
  assert.equal(f.database.row, null);
 }
});

test('a pending explicit DELETE still excludes a passive commit until guarded release', async () => {
 for (let iteration = 0; iteration < barrierIterations; iteration++) {
  const f = fixture(), response = deferred(), active = f.page({deleteResponse: response});
  active.auth.adopt(JSON.parse(f.shared.get('session')), f.jar.value);
  const logout = active.access.explicitLogout(); await settle();
  assert.equal(active.calls.at(-1).opt.method, 'DELETE'); assert.ok(f.database.row);
  let entered = false; const passive = f.page();
  const commit = passive.auth.runPassiveSynchronous(() => { entered = true; }); await settle();
  assert.equal(entered, false); await passive.tick(25); assert.equal(entered, false);
  response.resolve(); await logout; assert.equal(f.database.row, null);
  await passive.tick(25); await commit; assert.equal(entered, true);
 }
});

test('late validation responses pass through the real Fetch adapter without overwriting a newer login', async () => {
 for (let iteration = 0; iteration < barrierIterations; iteration++) {
  const f = fixture(), response = deferred(), old = f.page({deferToken: response});
  const validation = old.access.ensureSession(); await settle();
  const next = f.page(), attempt = next.auth.beginLogin();
  await next.access.acceptLogin({accountId: '1a2', jwt: 'private-new-cookie'}, attempt);
  const nextGeneration = next.auth.tabGeneration;
  response.resolve(); await assert.rejects(validation, (error) => error.status === 409);
  assert.equal(f.jar.value, 'private-new-cookie'); assert.equal(JSON.parse(f.shared.get('session')).generation, nextGeneration);
  assert.equal(old.auth.accountId, null); assert.equal(old.calls[0].opt.credentials, 'omit');
 }
});

test('captured shared-session validation never switches to a replacement cookie', async () => {
  const f = fixture(), page = f.page(), shared = JSON.parse(f.shared.get('session')), captured = f.jar.value;
  f.jar.value = 'private-replacement-cookie';
  const result = await page.access._validateAndAdopt(shared, captured);
  assert.equal(result.status, 'stale'); assert.equal(page.calls.length, 0); assert.equal(f.jar.value, 'private-replacement-cookie');
});

test('anonymous token and missing real root actor retain authentication rejection', async () => {
  for (const options of [{anonymous: true}, {invalidActor: true}]) {
    const f = fixture(), page = f.page(options);
    await assert.rejects(page.access.ensureSession(), (error) => error.status === 401);
    assert.equal(page.auth.accountId, null); assert.equal(f.database.row, null);
  }
});

test('sync status errors and thenable misuse are not silently converted to successful commits', async () => {
  const f = fixture(), page = f.page(), denied = {status: 409, message: 'Session changed during validation'};
  await assert.rejects(page.auth.runPassiveSynchronous(() => { throw denied; }), (error) => error === denied);
  await assert.rejects(page.auth.runPassiveSynchronous(() => Promise.resolve()), /must be synchronous/);
  assert.equal(f.database.row, null);
});
