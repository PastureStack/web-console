import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import AuthSessionService from 'ui/services/auth-session';
import AccessService from 'ui/services/access';
import C from 'ui/utils/constants';

const initialGeneration = '1762362000000.' + 'a'.repeat(64);
const barrierIterations = 100;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return {promise, resolve};
};

function fixture() {
  window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify({generation: initialGeneration, accountId: '1a1', committedAt: Date.now()}));
  const shared = {get: () => window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY)};
  const jar = {value: 'private-old-cookie'};
  const database = {row: null, queue: [], active: null, dropNextCompletion: false, dropped: deferred()};
  const pages = [];
  database.db = {transaction(store, mode) {
    if (store !== 'locks') { throw new Error('Exact auth lock store required'); }
    const ops = [];
    const tx = {mode, objectStore: () => ({
      get() { const req = {}; ops.push(() => { req.result = database.row ? {...database.row} : undefined; req.onsuccess?.(); }); return req; },
      put(value) { database.row = {...value}; },
      delete() { database.row = null; },
    }), abort() { tx.aborted = true; }};
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
        if (database.dropNextCompletion) { database.dropNextCompletion = false; database.dropped.resolve(); }
        else if (job.tx.aborted) { job.tx.onabort?.(); }
        else { job.tx.oncomplete?.(); }
        pump();
      });
    });
  }
  function page({deferToken, deleteResponse, anonymous = false, invalidActor = false} = {}) {
    const calls = [], tokenSent = deferred(), deleteSent = deferred(), busy = deferred(), resume = deferred();
    const auth = AuthSessionService.create({lockManager: null,
      _openLockDatabase: () => resolve(database.db),
      _waitForLock() { busy.resolve(); return resume.promise; },
      _broadcastChange() {},
    });
    const access = AccessService.create({authSession: auth,
      cookies: {get: () => jar.value, remove: () => { jar.value = null; }, setWithOptions(name, value) { jar.value = value; return true; }},
      session: {get: () => undefined, setProperties() {}},
      userStore: {rawRequest: async (opt) => {
        if (!['token', '', 'token/current'].includes(opt.url)) { throw new Error('Exact session route required'); }
        calls.push(opt);
        const captured = opt.headers?.Authorization?.replace(/^Bearer /, '') || jar.value;
        if (opt.url === 'token') { tokenSent.resolve(); if (deferToken) { await deferToken.promise; } }
        if (opt.method === 'DELETE') { deleteSent.resolve(); if (deleteResponse) { await deleteResponse.promise; } }
        // The real Chromium loopback control separately verifies this browser
        // credentials rule through the locked vendor Fetch adapter.
        if (opt.credentials !== 'omit' && opt.method !== 'DELETE') { jar.value = captured; }
        const body = opt.url === 'token' ? {data: [anonymous ? {accountId: null, user: null, userIdentity: null} : {userIdentity: {externalId: 'owner', externalIdType: 'provider'}}]} : {};
        return {body, status: 200, headers: {get: (name) => name === C.HEADER.USER_ID ? invalidActor ? '' : '1a1' : null}};
      }},
    });
    const value = {auth, access, calls, tokenSent, deleteSent, busy, resume}; pages.push(value); return value;
  }
  return {page, shared, jar, database, dispose() { run(() => { for (const value of pages) { value.access.destroy(); value.auth.destroy(); } }); }};
}

module('Unit | Service | passive authentication reload', function(hooks) {
  let previous;
  hooks.beforeEach(function() { previous = window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY); });
  hooks.afterEach(function() {
    if (previous === null) { window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY); }
    else { window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, previous); }
  });

  test('reload after a passive transaction commit cannot leave an orphan lease', async function(assert) {
    for (let iteration = 0; iteration < barrierIterations; iteration++) {
      const f = fixture(), old = f.page();
      try {
        f.database.dropNextCompletion = true;
        old.access.ensureSession();
        await f.database.dropped.promise;
        assert.strictEqual(f.database.row, null);
        const fresh = f.page();
        await fresh.access.ensureSession();
        assert.strictEqual(fresh.auth.get('tabGeneration'), initialGeneration);
        assert.strictEqual(fresh.auth.get('accountId'), '1a1');
        assert.strictEqual(f.database.row, null);
      } finally { f.dispose(); }
    }
  });

  test('a pending explicit DELETE still excludes a passive commit until guarded release', async function(assert) {
    for (let iteration = 0; iteration < barrierIterations; iteration++) {
      const f = fixture(), response = deferred(), active = f.page({deleteResponse: response});
      try {
        active.auth.adopt(JSON.parse(f.shared.get()), f.jar.value);
        const logout = active.access.explicitLogout(); await active.deleteSent.promise;
        assert.strictEqual(active.calls.at(-1).method, 'DELETE'); assert.ok(f.database.row);
        let entered = false; const passive = f.page();
        const commit = passive.auth.runPassiveSynchronous(() => { entered = true; });
        await passive.busy.promise;
        assert.false(entered);
        response.resolve(); await logout; assert.strictEqual(f.database.row, null);
        passive.resume.resolve(); await commit; assert.true(entered);
      } finally { response.resolve(); f.dispose(); }
    }
  });

  test('late validation responses cannot overwrite a newer login cookie or generation', async function(assert) {
    for (let iteration = 0; iteration < barrierIterations; iteration++) {
      const f = fixture(), response = deferred(), old = f.page({deferToken: response});
      try {
        const validation = old.access.ensureSession(); await old.tokenSent.promise;
        const next = f.page(), attempt = next.auth.beginLogin();
        await next.access.acceptLogin({accountId: '1a2', jwt: 'private-new-cookie'}, attempt);
        const nextGeneration = next.auth.get('tabGeneration');
        response.resolve(); await assert.rejects(validation, (error) => error.status === 409);
        assert.strictEqual(f.jar.value, 'private-new-cookie');
        assert.strictEqual(JSON.parse(f.shared.get()).generation, nextGeneration);
        assert.strictEqual(old.auth.get('accountId'), null); assert.strictEqual(old.calls[0].credentials, 'omit');
      } finally { response.resolve(); f.dispose(); }
    }
  });

  test('captured shared-session validation never switches to a replacement cookie', async function(assert) {
    const f = fixture(), page = f.page(), shared = JSON.parse(f.shared.get()), captured = f.jar.value;
    try {
      f.jar.value = 'private-replacement-cookie';
      const result = await page.access._validateAndAdopt(shared, captured);
      assert.strictEqual(result.status, 'stale'); assert.strictEqual(page.calls.length, 0);
      assert.strictEqual(f.jar.value, 'private-replacement-cookie');
    } finally { f.dispose(); }
  });

  test('anonymous token and missing real root actor retain authentication rejection', async function(assert) {
    for (const options of [{anonymous: true}, {invalidActor: true}]) {
      const f = fixture(), page = f.page(options);
      try {
        await assert.rejects(page.access.ensureSession(), (error) => error.status === 401);
        assert.strictEqual(page.auth.get('accountId'), null); assert.strictEqual(f.database.row, null);
      } finally { f.dispose(); }
    }
  });

  test('sync status errors and thenable misuse are not silently converted to successful commits', async function(assert) {
    const f = fixture(), page = f.page(), denied = {status: 409, message: 'Session changed during validation'};
    try {
      await assert.rejects(page.auth.runPassiveSynchronous(() => { throw denied; }), (error) => error === denied);
      await assert.rejects(page.auth.runPassiveSynchronous(() => Promise.resolve()), /must be synchronous/);
      assert.strictEqual(f.database.row, null);
    } finally { f.dispose(); }
  });
});
