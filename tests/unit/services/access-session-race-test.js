import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { Promise, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import AccessService from 'ui/services/access';
import AuthSessionService from 'ui/services/auth-session';
import AuditLogsRoute from 'ui/admin-tab/audit-logs/route';
import C from 'ui/utils/constants';

function generation(index) {
  let timestamp = String(1726358400000 + index).padStart(13, '0');
  let suffix = index.toString(16).padStart(64, '0').slice(-64);
  return `${timestamp}.${suffix}`;
}

function deferred() {
  let resolveValue;
  let rejectValue;
  let promise = new Promise((resolvePromise, rejectPromise) => {
    resolveValue = resolvePromise;
    rejectValue = rejectPromise;
  });
  return {promise, resolve: resolveValue, reject: rejectValue};
}

function serialLockManager() {
  let tail = resolve();
  return {
    request(name, options, callback) {
      let next = tail.then(callback);
      tail = next.catch(() => undefined);
      return next;
    },
  };
}

function cookieService(browser) {
  return EmberObject.create({
    get() {
      return browser.cookie;
    },
    setWithOptions(name, value) {
      if ( browser.refuseCookie ) {
        return false;
      }
      browser.cookie = value;
      return true;
    },
    remove() {
      browser.cookie = undefined;
      return true;
    },
  });
}

function sessionService() {
  let values = {};
  return EmberObject.create({
    get(key) {
      return values[key];
    },
    set(key, value) {
      values[key] = value;
      return value;
    },
    setProperties(next) {
      Object.assign(values, next || {});
      return this;
    },
    clear() {
      values = {};
    },
  });
}

function createAccess(browser, authSession, handler) {
  return AccessService.create({
    authSession,
    cookies: cookieService(browser),
    session: sessionService(),
    userStore: EmberObject.create({rawRequest: handler}),
  });
}

function currentTokenResponse(token, accountId) {
  return {body: {data: [token]}, headers: {get(name) {
    return name === C.HEADER.USER_ID ? accountId : null;
  }}};
}

module('Unit | Service | access session race', function(hooks) {
  hooks.beforeEach(function() {
    window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
  });

  hooks.afterEach(function() {
    window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
  });

  test('a late audit pagination 401 recovers its captured session without deleting a newer login', async function(assert) {
    let browser = {cookie: 'audit-old-cookie'};
    let lockManager = serialLockManager();
    let authA = AuthSessionService.create({lockManager});
    let authB = AuthSessionService.create({lockManager});
    let oldRecord = authA.commit(generation(901), '1a1', browser.cookie);
    authB.adopt(oldRecord, browser.cookie);
    let response = deferred();
    let deletes = 0;
    let clears = 0;
    let recovery;
    let access = createAccess(browser, authA, (options) => {
      if (options.method === 'DELETE') {
        deletes++;
      }
      return resolve({body: {data: [{accountId: '1a2', user: 'new-account'}]}});
    });
    let clear = access._clearOwnedLocalState.bind(access);
    access._clearOwnedLocalState = (...args) => { clears++; return clear(...args); };
    let model = EmberObject.create({
      auditLog: EmberObject.create({followPagination() { return response.promise; }}),
      queryError: null,
    });
    let route = AuditLogsRoute.create({
      access,
      controller: EmberObject.create({model}),
      send(name, resource, timedOut, returnTo, capturedGeneration, status) {
        assert.strictEqual(name, 'sessionInvalid', 'the ordinary passive auth boundary is used');
        assert.strictEqual(capturedGeneration, oldRecord.generation, 'the request owns its starting generation');
        recovery = access.handlePassiveFailure(capturedGeneration, status);
      },
    });
    try {
      let pending = route.actions.next.call(route);
      browser.cookie = 'audit-new-cookie';
      let newRecord = authB.commit(generation(902), '1a2', browser.cookie);
      response.reject({status: 401});
      await pending;
      let result = await recovery;
      assert.strictEqual(result.status, 'adopted', 'the old tab adopts the newer valid login');
      assert.strictEqual(authA.capture(), newRecord.generation);
      assert.strictEqual(browser.cookie, 'audit-new-cookie', 'the new cookie survives');
      assert.strictEqual(authA.readShared().generation, newRecord.generation);
      assert.strictEqual(deletes, 0, 'no passive DELETE is sent');
      assert.strictEqual(clears, 0, 'no new local or shared state is cleared');
      assert.notOk(route.controller.get('isFiltering'), 'the failed request releases its spinner');
      assert.strictEqual(route.get('timer'), null, 'the failed query is not retried automatically');
    } finally {
      run(() => { route.destroy(); access.destroy(); authA.destroy(); authB.destroy(); });
    }
  });

  test('a 200 login-options object is rejected instead of creating a session', async function(assert) {
    let browser = {cookie: 'expired-token'};
    let shared = {
      generation: generation(10),
      accountId: '1a1',
      committedAt: 1726358400010,
    };
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify(shared));
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let access = createAccess(browser, auth, (options) => {
      assert.strictEqual(options.url, 'token', 'the current-token endpoint is queried once');
      return resolve({body: {data: [{
        accountId: null,
        jwt: null,
        user: null,
        userIdentity: null,
        redirectUrl: 'https://identity.example.invalid/authorize',
        security: true,
      }]}});
    });
    let error;

    try {
      await access.ensureSession();
    } catch (caught) {
      error = caught;
    }

    assert.deepEqual(error, {status: 401, message: 'No authenticated session'},
      'the unauthenticated 200 response becomes the stable 401 contract');
    assert.strictEqual(auth.capture(), null, 'the tab never adopts the stale generation');
    assert.deepEqual(JSON.parse(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY)), shared,
      'ensureSession does not create or update a generation after validation fails');
    assert.strictEqual(browser.cookie, 'expired-token',
      'session cleanup remains in the generation-aware passive recovery path');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('validation clears one matching expired session and then stays invalid', async function(assert) {
    let browser = {cookie: 'expired-owned-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let owned = auth.commit(generation(20), '1a1', browser.cookie);
    let access = createAccess(browser, auth, () => resolve({body: {data: [{
      accountId: null,
      jwt: null,
      user: null,
      userIdentity: null,
      security: true,
    }]}}));
    let clears = 0;
    let clearOwnedLocalState = access._clearOwnedLocalState.bind(access);
    access._clearOwnedLocalState = (sessionGeneration) => {
      clears++;
      return clearOwnedLocalState(sessionGeneration);
    };

    let first = await access._validateAndAdopt(owned, browser.cookie);
    let second = await access._validateAndAdopt(owned, 'expired-owned-token');

    assert.strictEqual(first.status, 'invalid', 'the matching expired session becomes invalid');
    assert.strictEqual(second.status, 'invalid', 'a duplicate result converges without a route reload');
    assert.strictEqual(clears, 1, 'shared and local state are cleared exactly once');
    assert.strictEqual(browser.cookie, undefined, 'the matching expired cookie is removed');
    assert.strictEqual(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY), null,
      'the matching shared generation is removed');
    assert.strictEqual(auth.capture(), null, 'the tab no longer owns an authenticated session');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('simultaneous passive 401s converge without DELETE or a new generation', async function(assert) {
    let browser = {cookie: 'expired-passive-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let expiredGeneration = generation(30);
    auth.commit(expiredGeneration, '1a1', browser.cookie);
    let response = deferred();
    let allReads = deferred();
    let reads = 0;
    let deletes = 0;
    let access = createAccess(browser, auth, (options) => {
      if ( options.method === 'DELETE' ) {
        deletes++;
        return resolve({status: 204});
      }
      reads++;
      if ( reads === 3 ) {
        allReads.resolve();
      }
      return response.promise;
    });
    let clears = 0;
    let clearOwnedLocalState = access._clearOwnedLocalState.bind(access);
    access._clearOwnedLocalState = (sessionGeneration) => {
      clears++;
      return clearOwnedLocalState(sessionGeneration);
    };

    let recoveries = [
      access.handlePassiveFailure(expiredGeneration, 401),
      access.handlePassiveFailure(expiredGeneration, 401),
      access.handlePassiveFailure(expiredGeneration, 401),
    ];
    await allReads.promise;
    response.resolve({body: {data: [{
      accountId: null,
      jwt: null,
      user: null,
      userIdentity: null,
      security: true,
    }]}});
    let results = await Promise.all(recoveries);

    assert.strictEqual(deletes, 0, 'passive expiry never revokes a server token');
    assert.strictEqual(reads, 3, 'the barrier releases only after every recovery validates');
    assert.ok(results.every((result) => result.status === 'invalid'),
      'every duplicate result converges directly on the login state');
    assert.strictEqual(clears, 1, 'only one recovery clears the matching shared session');
    assert.strictEqual(browser.cookie, undefined, 'all passive failures converge on no cookie');
    assert.strictEqual(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY), null,
      'no replacement generation is created');
    assert.strictEqual(auth.capture(), null, 'the tab converges to the unauthenticated state');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('an expired-token response cannot clear a newer committed session', async function(assert) {
    let browser = {cookie: 'old-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let oldRecord = auth.commit(generation(40), '1a1', browser.cookie);
    let response = deferred();
    let requested = deferred();
    let access = createAccess(browser, auth, () => {
      requested.resolve();
      return response.promise;
    });
    let clears = 0;
    let clearOwnedLocalState = access._clearOwnedLocalState.bind(access);
    access._clearOwnedLocalState = (sessionGeneration) => {
      clears++;
      return clearOwnedLocalState(sessionGeneration);
    };

    let validating = access._validateAndAdopt(oldRecord, browser.cookie);
    await requested.promise;
    browser.cookie = 'new-token';
    let newRecord = auth.commit(generation(41), '1a2', browser.cookie);
    response.resolve({body: {data: [{
      accountId: null,
      jwt: null,
      user: null,
      userIdentity: null,
      security: true,
    }]}});
    let outcome = await validating;

    assert.strictEqual(outcome.status, 'stale', 'the old validation loses ownership');
    assert.strictEqual(outcome.generation, newRecord.generation, 'the newer generation is reported');
    assert.strictEqual(clears, 0, 'the old response cannot clear newer local or shared state');
    assert.strictEqual(browser.cookie, 'new-token', 'the newer cookie survives');
    assert.strictEqual(auth.capture(), newRecord.generation, 'the tab retains the newer generation');
    assert.strictEqual(auth.readShared().generation, newRecord.generation,
      'the newer shared session remains committed');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('identity-bearing current-token responses remain authenticated without requiring jwt', async function(assert) {
    let responses = [
      {accountId: '1a1', user: 'administrator'},
      {accountId: null, user: null, userIdentity: {externalIdType: 'oidc_user', externalId: 'subject-1'}},
    ];

    for (let index = 0; index < responses.length; index++) {
      let browser = {cookie: `valid-token-${index}`};
      let auth = AuthSessionService.create({lockManager: serialLockManager()});
      let access = createAccess(browser, auth, () => resolve(currentTokenResponse(responses[index], '1a1')));
      let result = await access.ensureSession();

      assert.strictEqual(result.status, 'active', 'the authenticated token is accepted');
      assert.ok(auth.capture(), 'a generation is committed for the authenticated response');
      assert.strictEqual(auth.get('accountId'), '1a1', 'the verified response supplies the actor');
      assert.notOk(responses[index].jwt, 'acceptance does not depend on an exposed jwt field');
      run(() => {
        access.destroy();
        auth.destroy();
      });
      window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
    }
  });

  test('a fresh cookie uses the verified response actor when the masked token body omits accountId', async function(assert) {
    let browser = {cookie: 'fresh-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let token = {jwt: '********', user: 'administrator', userIdentity: {externalId: 'admin'}};
    let access = createAccess(browser, auth, () => resolve(currentTokenResponse(token, '1a1')));
    try {
      let result = await access.ensureSession();
      assert.strictEqual(result.status, 'active');
      assert.strictEqual(auth.get('accountId'), '1a1');
      assert.strictEqual(auth.readShared().accountId, '1a1');
      assert.notOk(Object.hasOwn(token, 'accountId'), 'the response body is not mutated');
      assert.notOk(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY).includes(browser.cookie), 'the cookie stays out of storage');
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('invalid or absent actor metadata cannot establish a session', async function(assert) {
    for (const [token, header] of [
      [{user: 'admin'}, '../1a1'],
      [{user: 'admin'}, '   '],
      [{user: 'admin'}, null],
      [{accountId: null, user: null, userIdentity: null, jwt: null}, '1a1'],
    ]) {
      let browser = {cookie: 'untrusted-metadata-cookie'};
      let auth = AuthSessionService.create({lockManager: serialLockManager()});
      let access = createAccess(browser, auth, () => resolve(currentTokenResponse(token, header)));
      try {
        await assert.rejects(access.ensureSession(), error => error.status === 401, 'identity and actor must both be verified');
        assert.strictEqual(auth.readShared(), null, 'no actor or generation is fabricated');
        assert.strictEqual(browser.cookie, 'untrusted-metadata-cookie', 'caller owns generation-aware cleanup');
      } finally { run(() => { access.destroy(); auth.destroy(); }); }
    }
  });

  test('the root user header identifies the actor and token virtual headers are ignored', async function(assert) {
    let browser = {cookie: 'root-actor-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let paths = [];
    let access = createAccess(browser, auth, options => {
      paths.push(options.url);
      if (options.url === 'token') {
        return resolve({body: {data: [{userIdentity: {externalId: 'not-an-account-id'}, jwt: 'masked'}]},
          headers: {get() { return '1a4'; }}});
      }
      return resolve({headers: {get(name) {
        return name === C.HEADER.USER_ID ? '1a1' : '1a5';
      }}});
    });
    try {
      await access.ensureSession();
      assert.deepEqual(paths, ['token', ''], 'actor lookup uses the unscoped API root after identity validation');
      assert.strictEqual(auth.get('accountId'), '1a1', 'neither virtual token nor environment account becomes the actor');
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('an authenticated body actor keeps the existing one-request path', async function(assert) {
    let browser = {cookie: 'body-actor-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let reads = 0;
    let access = createAccess(browser, auth, options => {
      reads++;
      assert.strictEqual(options.url, 'token');
      return resolve({body: {data: [{accountId: '1a1', user: 'admin'}]}, headers: {get() { return '1a4'; }}});
    });
    try {
      await access.ensureSession();
      assert.strictEqual(reads, 1);
      assert.strictEqual(auth.get('accountId'), '1a1', 'the virtual token header does not override the authenticated body');
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('login options never trigger an actor probe even when virtual headers exist', async function(assert) {
    let browser = {cookie: 'expired-options-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let paths = [];
    let access = createAccess(browser, auth, options => {
      paths.push(options.url);
      return resolve(currentTokenResponse({accountId: null, user: null, userIdentity: null, jwt: 'masked'}, '1a4'));
    });
    try {
      await assert.rejects(access.ensureSession(), error => error.status === 401);
      assert.deepEqual(paths, ['token']);
      assert.strictEqual(auth.readShared(), null);
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('actor lookup failures preserve their authentication or permission result', async function(assert) {
    for (const status of [401, 403, 502]) {
      let browser = {cookie: 'actor-lookup-cookie'};
      let auth = AuthSessionService.create({lockManager: serialLockManager()});
      let access = createAccess(browser, auth, options => options.url === 'token' ?
        resolve(currentTokenResponse({user: 'admin'}, '1a4')) : reject({status}));
      try {
        await assert.rejects(access.ensureSession(), error => error.status === status);
        assert.strictEqual(auth.readShared(), null);
        assert.strictEqual(browser.cookie, 'actor-lookup-cookie');
      } finally { run(() => { access.destroy(); auth.destroy(); }); }
    }
  });

  test('a cookie replacement during the root actor request cannot create a session', async function(assert) {
    let browser = {cookie: 'actor-request-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let requested = deferred(), response = deferred();
    let access = createAccess(browser, auth, options => {
      if (options.url === 'token') { return resolve(currentTokenResponse({user: 'old-user'}, '1a4')); }
      requested.resolve();
      return response.promise;
    });
    try {
      let pending = access.ensureSession();
      await requested.promise;
      browser.cookie = 'replacement-cookie';
      response.resolve(currentTokenResponse({}, '1a1'));
      await assert.rejects(pending, error => error.status === 409);
      assert.strictEqual(auth.readShared(), null);
      assert.strictEqual(browser.cookie, 'replacement-cookie');
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('ensureSession and peer adoption repair only the matching legacy null actor', async function(assert) {
    for (const method of ['ensureSession', 'adoptSharedSession']) {
      let browser = {cookie: 'legacy-actor-cookie'};
      let auth = AuthSessionService.create({lockManager: serialLockManager()});
      let record = auth.commit(generation(370), null, browser.cookie);
      let access = createAccess(browser, auth, () => resolve(currentTokenResponse({user: 'administrator'}, '1a1')));
      try {
        let result = await access[method]();
        assert.ok(['active', 'adopted'].includes(result.status), method);
        assert.strictEqual(auth.capture(), record.generation, 'repair preserves the validated generation');
        assert.strictEqual(auth.get('accountId'), '1a1');
        assert.strictEqual(auth.readShared().accountId, '1a1');
      } finally {
        run(() => { access.destroy(); auth.destroy(); });
        window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
      }
    }
  });

  test('two tabs converge when restoring the same legacy null actor', async function(assert) {
    let browser = {cookie: 'legacy-shared-cookie'};
    let locks = serialLockManager();
    let authA = AuthSessionService.create({lockManager: locks});
    let authB = AuthSessionService.create({lockManager: locks});
    let record = authA.commit(generation(371), null, browser.cookie);
    let responses = [deferred(), deferred()];
    let accessA = createAccess(browser, authA, () => responses[0].promise);
    let accessB = createAccess(browser, authB, () => responses[1].promise);
    try {
      let a = accessA.ensureSession(), b = accessB.ensureSession();
      responses.forEach(response => response.resolve(currentTokenResponse({user: 'admin'}, '1a1')));
      await Promise.all([a, b]);
      assert.strictEqual(authA.get('accountId'), '1a1');
      assert.strictEqual(authB.get('accountId'), '1a1');
      assert.strictEqual(authA.capture(), record.generation);
      assert.strictEqual(authB.capture(), record.generation);
    } finally { run(() => { accessA.destroy(); accessB.destroy(); authA.destroy(); authB.destroy(); }); }
  });

  test('late actor repair cannot overwrite a newer login or newer null generation', async function(assert) {
    for (const method of ['ensureSession', 'adoptSharedSession']) {
      let browser = {cookie: 'old-actor-cookie'};
      let locks = serialLockManager();
      let authA = AuthSessionService.create({lockManager: locks});
      let authB = AuthSessionService.create({lockManager: locks});
      authA.commit(generation(372), null, browser.cookie);
      let response = deferred(), requested = deferred();
      let access = createAccess(browser, authA, () => { requested.resolve(); return response.promise; });
      try {
        let pending = access[method]();
        await requested.promise;
        browser.cookie = 'new-actor-cookie';
        let newer = authB.commit(generation(373), '1a2', browser.cookie);
        response.resolve(currentTokenResponse({user: 'old-user'}, '1a1'));
        if (method === 'ensureSession') {
          await assert.rejects(pending, error => error.status === 409);
        } else {
          assert.strictEqual((await pending).status, 'stale');
        }
        assert.strictEqual(authB.readShared().generation, newer.generation);
        assert.strictEqual(authB.readShared().accountId, '1a2');
        assert.strictEqual(browser.cookie, 'new-actor-cookie');
      } finally {
        run(() => { access.destroy(); authA.destroy(); authB.destroy(); });
        window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
      }
    }

    let browser = {cookie: 'unchanged-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    auth.commit(generation(374), null, browser.cookie);
    let response = deferred();
    let access = createAccess(browser, auth, () => response.promise);
    try {
      let pending = access.ensureSession();
      auth.commit(generation(375), null, browser.cookie);
      response.resolve(currentTokenResponse({user: 'old-user'}, '1a1'));
      await assert.rejects(pending, error => error.status === 409);
      assert.strictEqual(auth.readShared().accountId, null, 'even an unbound newer generation is not repaired by an old response');
      assert.strictEqual(auth.readShared().generation, generation(375));
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('a forbidden actor lookup preserves the legacy session for ordinary permission handling', async function(assert) {
    let browser = {cookie: 'forbidden-actor-cookie'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let record = auth.commit(generation(376), null, browser.cookie);
    let access = createAccess(browser, auth, options => options.url === 'token' ?
      resolve(currentTokenResponse({user: 'admin'}, '1a4')) : reject({status: 403}));
    try {
      await assert.rejects(access.adoptSharedSession(), error => error.status === 403);
      assert.deepEqual(auth.readShared(), record);
      assert.strictEqual(browser.cookie, 'forbidden-actor-cookie');
    } finally { run(() => { access.destroy(); auth.destroy(); }); }
  });

  test('a verified actor mismatch never replaces an existing shared actor', async function(assert) {
    for (const method of ['ensureSession', 'adoptSharedSession']) {
      let browser = {cookie: 'same-cookie'};
      let auth = AuthSessionService.create({lockManager: serialLockManager()});
      let record = auth.commit(generation(377), '1a1', browser.cookie);
      let access = createAccess(browser, auth, () => resolve(currentTokenResponse({user: 'other-user'}, '1a2')));
      try {
        await assert.rejects(access[method](), error => error.status === 409);
        assert.deepEqual(auth.readShared(), record, 'the existing generation and actor are unchanged');
        assert.strictEqual(browser.cookie, 'same-cookie');
      } finally {
        run(() => { access.destroy(); auth.destroy(); });
        window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
      }
    }
  });

  test('a delayed 401 cannot revoke or clear a newer TOTP or Passkey session in 100 deterministic runs', async function(assert) {
    assert.expect(504);
    let methods = ['totp', 'webauthn'];

    for (let iteration = 0; iteration < 100; iteration++) {
      let browser = {cookie: `old-jwt-${iteration}`};
      let lockManager = serialLockManager();
      let authA = AuthSessionService.create({lockManager});
      let authB = AuthSessionService.create({lockManager});
      let oldGeneration = generation(iteration * 2 + 1);
      let newGeneration = generation(iteration * 2 + 2);
      let oldRecord = authA.commit(oldGeneration, '1a1', browser.cookie);
      authB.adopt(oldRecord, browser.cookie);
      let oldResponse = deferred();
      let deleteCount = 0;
      let method = methods[iteration % methods.length];
      let newJwt = `new-jwt-${iteration}`;
      let currentToken = {accountId: '1a1', user: 'administrator'};

      let accessA = createAccess(browser, authA, (options) => {
        if ( options.method === 'DELETE' ) {
          deleteCount++;
          return resolve({status: 204});
        }
        if ( options.url === '' ) {
          return oldResponse.promise;
        }
        if ( options.url === 'token' ) {
          return resolve({body: {data: [currentToken]}});
        }
        return reject({status: 500});
      });
      let mfaRequest;
      let accessB = createAccess(browser, authB, (options) => {
        mfaRequest = options;
        return resolve({body: Object.assign({jwt: newJwt}, currentToken)});
      });
      authB.set('pendingLogin', {
        baseGeneration: oldGeneration,
        generation: newGeneration,
        startedAt: 1726358400000 + iteration * 2 + 2,
      });

      let staleResult = accessA.testAuth(oldGeneration).catch((error) => {
        return accessA.handlePassiveFailure(oldGeneration, error.status);
      });
      let mfaPayload = method === 'webauthn' ?
        {mfaMethod: method, webAuthnResponse: {id: 'virtual-credential'}} :
        {mfaMethod: method, mfaCode: 'synthetic-code'};
      await accessB.completeMfa(mfaPayload);
      oldResponse.reject({status: 401});
      let outcome = await staleResult;

      assert.strictEqual(mfaRequest.data.clientSessionId, newGeneration,
        'the MFA completion is bound to the login generation');
      assert.strictEqual(mfaRequest.data.mfaMethod, method, 'both factor completion paths use the same contract');
      assert.strictEqual(outcome.status, 'adopted', 'the old tab adopts the newer authenticated session');
      assert.strictEqual(browser.cookie, newJwt, 'the newer cookie survives the old response');
      assert.strictEqual(deleteCount, 0, 'a passive failure never sends DELETE');

      run(() => {
        accessA.destroy();
        accessB.destroy();
        authA.destroy();
        authB.destroy();
      });
    }

    let stored = JSON.parse(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY));
    assert.deepEqual(Object.keys(stored).sort(), ['accountId', 'committedAt', 'generation'],
      'the final shared record contains no JWT or factor response');
    assert.notOk(JSON.stringify(stored).includes('jwt'), 'no JWT is persisted in Web Storage');
    assert.notOk(JSON.stringify(stored).includes('synthetic-code'), 'no OTP is persisted in Web Storage');
    assert.notOk(JSON.stringify(stored).includes('virtual-credential'), 'no passkey response is persisted in Web Storage');
  });

  test('simultaneous passive errors adopt a new account without a DELETE storm', async function(assert) {
    let browser = {cookie: 'old-account-token'};
    let lockManager = serialLockManager();
    let auth = AuthSessionService.create({lockManager});
    let oldGeneration = generation(300);
    let newGeneration = generation(301);
    auth.adopt({generation: oldGeneration, accountId: '1a1', committedAt: Date.now()}, browser.cookie);
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify({
      generation: newGeneration,
      accountId: '1a2',
      committedAt: Date.now(),
    }));
    browser.cookie = 'new-account-token';
    let deletes = 0;
    let reads = 0;
    let access = createAccess(browser, auth, (options) => {
      if ( options.method === 'DELETE' ) {
        deletes++;
      }
      reads++;
      return resolve({body: {data: [{accountId: '1a2', user: 'second-user'}]}});
    });

    let results = await Promise.all([
      access.handlePassiveFailure(oldGeneration, 401),
      access.handlePassiveFailure(oldGeneration, 401),
      access.handlePassiveFailure(oldGeneration, 401),
      access.handlePassiveFailure(oldGeneration, 403),
    ]);

    assert.strictEqual(deletes, 0, 'passive errors never revoke any server token');
    assert.strictEqual(results[3].status, 'forbidden', 'a 403 remains a permission denial');
    assert.ok(results.slice(0, 3).every((result) => ['adopted', 'active'].includes(result.status)),
      'all delayed 401 handlers converge on the newer account');
    assert.strictEqual(auth.capture(), newGeneration, 'the tab now owns the newer generation');
    assert.strictEqual(auth.get('accountId'), '1a2', 'the account switch is adopted');
    assert.ok(reads >= 3, 'each delayed error revalidates ownership without destructive side effects');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('three waiting tabs adopt one committed login without another authentication ceremony', async function(assert) {
    let browser = {cookie: 'shared-login-token'};
    let lockManager = serialLockManager();
    let owner = AuthSessionService.create({lockManager});
    let waiting = [0, 1, 2].map(() => AuthSessionService.create({lockManager}));
    let committed = generation(350);
    owner.commit(committed, '1a1', browser.cookie);
    let tokenReads = 0;
    let accesses = waiting.map((auth) => createAccess(browser, auth, (options) => {
      assert.strictEqual(options.url, 'token', 'a waiting tab verifies the shared cookie');
      tokenReads++;
      return resolve({body: {data: [{accountId: '1a1', user: 'administrator'}]}});
    }));

    let results = await Promise.all(accesses.map((access) => access.adoptSharedSession()));

    assert.strictEqual(tokenReads, 3, 'each of the three tabs performs one server validation');
    assert.ok(results.every((result) => result.status === 'adopted'),
      'all waiting tabs adopt the committed login');
    assert.ok(waiting.every((auth) => auth.capture() === committed),
      'all tabs converge on the same generation');
    assert.strictEqual(browser.cookie, 'shared-login-token', 'no tab rewrites or clears the shared cookie');
    run(() => {
      accesses.forEach((access) => access.destroy());
      waiting.forEach((auth) => auth.destroy());
      owner.destroy();
    });
  });

  test('a peer reads cookie and generation only after the login mutex releases', async function(assert) {
    let browser = {cookie: undefined};
    let releaseLock = deferred();
    let lockManager = {
      request(name, options, callback) {
        return releaseLock.promise.then(callback);
      },
    };
    let auth = AuthSessionService.create({lockManager});
    let tokenReads = 0;
    let access = createAccess(browser, auth, () => {
      tokenReads++;
      return resolve({body: {data: [{accountId: '1a1', user: 'administrator'}]}});
    });
    let committed = generation(360);

    let adopting = access.adoptSharedSession();
    // Model acceptLogin's ordering while it still owns the cross-tab mutex:
    // cookie first, then the non-sensitive generation commit.
    browser.cookie = 'fresh-login-token';
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify({
      generation: committed,
      accountId: '1a1',
      committedAt: 1726358400360,
    }));
    releaseLock.resolve();
    let outcome = await adopting;

    assert.strictEqual(outcome.status, 'adopted', 'the waiting tab adopts instead of caching a pre-lock empty read');
    assert.strictEqual(tokenReads, 1, 'the committed session is validated once');
    assert.strictEqual(auth.capture(), committed, 'the peer owns the generation committed behind the barrier');
    assert.strictEqual(browser.cookie, 'fresh-login-token', 'the peer never clears the newly written cookie');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('a manual refresh rebuilds the in-memory session from the cookie and committed generation', async function(assert) {
    let browser = {cookie: 'refresh-token'};
    let generationBeforeRefresh = generation(375);
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify({
      generation: generationBeforeRefresh,
      accountId: '1a1',
      committedAt: 1726358400375,
    }));
    let refreshedAuth = AuthSessionService.create({lockManager: serialLockManager()});
    let reads = 0;
    let access = createAccess(browser, refreshedAuth, (options) => {
      reads++;
      return resolve({body: {data: [{accountId: '1a1', user: 'administrator'}]}});
    });

    let result = await access.ensureSession();

    assert.strictEqual(result.status, 'active', 'the refreshed page validates an existing cookie');
    assert.strictEqual(reads, 1, 'refresh performs one token validation');
    assert.strictEqual(refreshedAuth.capture(), generationBeforeRefresh,
      'refresh adopts the previously committed generation');
    assert.strictEqual(refreshedAuth.get('tokenSnapshot'), 'refresh-token',
      'the token snapshot is rebuilt only in memory');
    assert.notOk(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY).includes('refresh-token'),
      'the JWT remains absent from Web Storage');
    run(() => {
      access.destroy();
      refreshedAuth.destroy();
    });
  });

  test('a direct logout after refresh adopts then revokes exactly the revalidated session', async function(assert) {
    let browser = {cookie: 'refreshed-owned-token'};
    let generationBeforeRefresh = generation(390);
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify({
      generation: generationBeforeRefresh,
      accountId: '1a1',
      committedAt: 1726358400390,
    }));
    let refreshedAuth = AuthSessionService.create({lockManager: serialLockManager()});
    let reads = 0;
    let deletes = 0;
    let header;
    let access = createAccess(browser, refreshedAuth, (options) => {
      if ( options.method === 'DELETE' ) {
        deletes++;
        header = options.headers[C.AUTH_SESSION.LOGOUT_HEADER];
        return resolve({status: 204});
      }
      reads++;
      return resolve({body: {data: [{accountId: '1a1', user: 'administrator'}]}});
    });

    await access.ensureSession();
    let outcome = await access.explicitLogout();

    assert.strictEqual(reads, 1, 'the refreshed tab validates the existing cookie once');
    assert.strictEqual(deletes, 1, 'the explicit action issues exactly one DELETE');
    assert.strictEqual(header, generationBeforeRefresh, 'the DELETE remains bound to the adopted generation');
    assert.strictEqual(outcome.status, 'complete', 'the bound logout completes');
    assert.strictEqual(browser.cookie, undefined, 'the adopted cookie is cleared after the response');
    assert.strictEqual(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY), null,
      'the matching shared generation is cleared');
    run(() => {
      access.destroy();
      refreshedAuth.destroy();
    });
  });

  test('explicit logout is coalesced, carries ownership, and waits for the response before clearing', async function(assert) {
    let browser = {cookie: 'owned-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let ownedGeneration = generation(400);
    auth.commit(ownedGeneration, '1a1', browser.cookie);
    let response = deferred();
    let deletes = 0;
    let header;
    let access = createAccess(browser, auth, (options) => {
      deletes++;
      header = options.headers[C.AUTH_SESSION.LOGOUT_HEADER];
      return response.promise;
    });

    let first = access.explicitLogout();
    let second = access.explicitLogout();
    await resolve();
    assert.strictEqual(deletes, 1, 'concurrent clicks issue at most one DELETE');
    assert.strictEqual(header, ownedGeneration, 'the DELETE is bound to the owned generation');
    assert.strictEqual(browser.cookie, 'owned-token', 'the cookie remains until DELETE settles');
    response.resolve({status: 204});
    await Promise.all([first, second]);
    assert.strictEqual(browser.cookie, undefined, 'the owned cookie is cleared after the response');
    assert.strictEqual(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY), null,
      'the owned shared record is cleared once');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('an owning tab repairs a cookie removed by pre-fix JavaScript without revoking the session', async function(assert) {
    let browser = {cookie: 'current-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let currentGeneration = generation(450);
    let initialRecord = auth.commit(currentGeneration, '1a1', browser.cookie);
    let deletes = 0;
    let reads = 0;
    let access = createAccess(browser, auth, (options) => {
      if ( options.method === 'DELETE' ) {
        deletes++;
        return resolve({status: 204});
      }
      reads++;
      return resolve({body: {data: [{accountId: '1a1', user: 'administrator'}]}});
    });

    browser.cookie = undefined;
    let outcome = await access.handlePassiveFailure(currentGeneration, 401);
    let recoveredRecord = JSON.parse(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY));

    assert.strictEqual(outcome.status, 'active', 'the same owned session remains active');
    assert.strictEqual(browser.cookie, 'current-token', 'the in-memory snapshot restores the cookie');
    assert.strictEqual(reads, 1, 'the restored cookie is revalidated with the server');
    assert.strictEqual(deletes, 0, 'cookie recovery never revokes a token');
    assert.strictEqual(recoveredRecord.generation, currentGeneration, 'ownership does not change');
    assert.ok(recoveredRecord.committedAt > initialRecord.committedAt,
      'the recovered commit always notifies other tabs after cookie readback');
    assert.notOk(JSON.stringify(recoveredRecord).includes('current-token'),
      'the repaired JWT still never enters Web Storage');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('invalid login responses and failed cookie readback never commit a half-session', async function(assert) {
    let browser = {cookie: undefined};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let access = createAccess(browser, auth, () => resolve());

    let missingError;
    let emptyError;
    let cookieError;
    try {
      await access.acceptLogin(null);
    } catch (error) {
      missingError = error;
    }
    try {
      await access.acceptLogin({jwt: ''});
    } catch (error) {
      emptyError = error;
    }
    assert.ok(/valid session token/.test(missingError && missingError.message), 'a missing JWT is rejected');
    assert.ok(/valid session token/.test(emptyError && emptyError.message), 'an empty JWT is rejected');
    browser.refuseCookie = true;
    try {
      await access.acceptLogin({jwt: 'uncommitted'}, {
        generation: generation(500), baseGeneration: null, startedAt: 1726358400500,
      });
    } catch (error) {
      cookieError = error;
    }
    assert.ok(/refused the session cookie/.test(cookieError && cookieError.message),
      'a refused cookie is rejected');
    assert.strictEqual(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY), null,
      'no generation is committed after a cookie failure');
    assert.strictEqual(auth.capture(), null, 'the tab has no partial ownership');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('an old OIDC callback is rejected before creating a token after a newer login commits', async function(assert) {
    let browser = {cookie: 'new-token'};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let oldAttempt = {
      baseGeneration: null,
      generation: generation(600),
      startedAt: 1726358400600,
    };
    let newGeneration = generation(601);
    auth.commit(newGeneration, '1a1', browser.cookie);
    let requests = 0;
    let access = createAccess(browser, auth, () => {
      requests++;
      return reject({status: 500});
    });

    let result = await access.login('old-authorization-code', 'oidcconfig', undefined, oldAttempt);

    assert.true(result.authSessionSuperseded, 'the old callback is identified as superseded');
    assert.strictEqual(requests, 0, 'the stale callback never reaches POST /token');
    assert.strictEqual(browser.cookie, 'new-token', 'the committed session remains untouched');
    assert.strictEqual(auth.capture(), newGeneration, 'ownership remains with the newer session');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('an in-flight older callback accepts the server superseded result without touching the newer session', async function(assert) {
    let browser = {cookie: undefined};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let oldAttempt = {
      baseGeneration: null,
      generation: generation(625),
      startedAt: 1726358400625,
    };
    let response = deferred();
    let postedGeneration;
    let access = createAccess(browser, auth, (options) => {
      postedGeneration = options.data.clientSessionId;
      return response.promise;
    });

    let pending = access.login('old-authorization-code', 'oidcconfig', undefined, oldAttempt);
    await resolve();
    let newerGeneration = generation(626);
    browser.cookie = 'newer-token';
    auth.commit(newerGeneration, '1a1', browser.cookie);
    response.reject({
      status: 409,
      body: {code: 'ClientSessionSuperseded', message: 'newer session completed'},
    });
    let result = await pending;

    assert.strictEqual(postedGeneration, oldAttempt.generation,
      'the request remains bound to the generation captured before the deferred response');
    assert.true(result.authSessionSuperseded, 'the precise server conflict is treated as a stale callback');
    assert.false(result.authSessionAccepted, 'the stale response never completes login');
    assert.strictEqual(browser.cookie, 'newer-token', 'the newer cookie is untouched');
    assert.strictEqual(auth.capture(), newerGeneration, 'the newer generation remains owned');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });

  test('callers cannot override the provider, authorization value, or bound generation', async function(assert) {
    let browser = {cookie: undefined};
    let auth = AuthSessionService.create({lockManager: serialLockManager()});
    let loginAttempt = {
      baseGeneration: null,
      generation: generation(650),
      startedAt: 1726358400650,
    };
    let requests = [];
    let access = createAccess(browser, auth, (options) => {
      requests.push(options.data);
      if ( requests.length === 1 ) {
        return resolve({body: {
          mfaRequired: true,
          mfaChallengeId: 'opaque-challenge',
          mfaMethods: ['totp'],
        }});
      }
      return resolve({body: {jwt: 'bound-token', accountId: '1a1'}});
    });

    await access.login('trusted-code', 'oidcconfig', {
      code: 'overridden-code',
      authProvider: 'untrusted-provider',
      clientSessionId: generation(999),
    }, loginAttempt);
    await access.completeMfa({
      code: 'opaque-challenge',
      mfaMethod: 'totp',
      mfaCode: '123456',
      authProvider: 'untrusted-provider',
      clientSessionId: generation(999),
    });

    assert.strictEqual(requests[0].code, 'trusted-code', 'the callback code comes from the route transaction');
    assert.strictEqual(requests[0].authProvider, 'oidcconfig', 'the route-selected provider cannot be overwritten');
    assert.strictEqual(requests[0].clientSessionId, loginAttempt.generation,
      'the primary request uses its captured generation');
    assert.strictEqual(requests[1].authProvider, 'mfa', 'the continuation provider is fixed');
    assert.strictEqual(requests[1].clientSessionId, loginAttempt.generation,
      'the MFA request retains the same bound generation');
    assert.strictEqual(browser.cookie, 'bound-token', 'the protected response completes normally');
    run(() => {
      access.destroy();
      auth.destroy();
    });
  });
});
