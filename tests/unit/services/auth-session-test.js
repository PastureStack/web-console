import { run } from '@ember/runloop';
import { Promise, resolve } from 'rsvp';
import { module, test } from 'qunit';
import AuthSessionService, { GENERATION_RE, parseRecord } from 'ui/services/auth-session';
import C from 'ui/utils/constants';

function deferred() {
  let resolveValue;
  let promise = new Promise((resolvePromise) => {
    resolveValue = resolvePromise;
  });
  return {promise, resolve: resolveValue};
}

module('Unit | Service | auth-session', function(hooks) {
  hooks.beforeEach(function() {
    window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
  });

  hooks.afterEach(function() {
    window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
  });

  test('stores only non-sensitive ownership metadata and keeps the token in memory', function(assert) {
    let service = AuthSessionService.create({
      lockManager: {request(name, options, callback) {
        return resolve().then(callback);
      }},
    });
    let generation = service.createGeneration();
    let record = service.commit(generation, '1a1', 'memory-only-jwt');
    let stored = JSON.parse(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY));

    assert.ok(GENERATION_RE.test(generation), 'the generation includes a timestamp and 256 bits of randomness');
    assert.deepEqual(Object.keys(stored).sort(), ['accountId', 'committedAt', 'generation'],
      'the shared record has only the documented non-sensitive fields');
    assert.notOk(JSON.stringify(stored).includes('memory-only-jwt'), 'the JWT never reaches localStorage');
    assert.strictEqual(service.get('tokenSnapshot'), 'memory-only-jwt', 'the tab snapshot remains in memory');
    assert.deepEqual(parseRecord(record), record, 'the committed record passes strict parsing');
    run(() => service.destroy());
  });

  test('the Web Locks mutex serializes deferred authentication work without an unlocked fallback', function(assert) {
    assert.expect(6);
    let entered = [];
    let releaseFirst;
    let firstBarrier = new Promise((resolveBarrier) => {
      releaseFirst = resolveBarrier;
    });
    let tail = resolve();
    let lockManager = {
      request(name, options, callback) {
        assert.strictEqual(name, C.AUTH_SESSION.LOCK_NAME, 'all auth mutations share one lock name');
        assert.strictEqual(options.mode, 'exclusive', 'the lock is exclusive');
        let next = tail.then(callback);
        tail = next.catch(() => undefined);
        return next;
      },
    };
    let service = AuthSessionService.create({lockManager});
    let first = service.runExclusive(() => {
      entered.push('first');
      return firstBarrier;
    });
    let second = service.runExclusive(() => {
      entered.push('second');
    });

    return resolve().then(() => {
      assert.deepEqual(entered, ['first'], 'the second callback cannot enter while the first is deferred');
      releaseFirst();
      return Promise.all([first, second]);
    }).then(() => {
      assert.deepEqual(entered, ['first', 'second'], 'the second callback enters only after release');
      run(() => service.destroy());
    });
  });

  test('the IndexedDB fallback serializes deferred work and verifies lease ownership', async function(assert) {
    let firstEntered = deferred();
    let releaseFirst = deferred();
    let entered = [];
    let first = AuthSessionService.create({lockManager: null});
    let second = AuthSessionService.create({lockManager: null});
    let db = await first._openLockDatabase();
    await first._releaseIndexedDbLock(db, '__test_cleanup__');

    // Delete any record left by an interrupted previous test without bypassing
    // IndexedDB transaction isolation.
    await new Promise((resolveDelete, rejectDelete) => {
      let transaction = db.transaction('locks', 'readwrite');
      transaction.objectStore('locks').delete(C.AUTH_SESSION.LOCK_NAME);
      transaction.oncomplete = resolveDelete;
      transaction.onerror = () => rejectDelete(transaction.error);
    });

    let firstWork = first.runExclusive((guard) => {
      entered.push('first');
      firstEntered.resolve();
      return releaseFirst.promise.then(() => guard.assertOwned());
    });
    await firstEntered.promise;
    let secondWork = second.runExclusive(() => {
      entered.push('second');
    });
    await resolve();
    assert.deepEqual(entered, ['first'], 'the fallback never enters a second critical section concurrently');

    releaseFirst.resolve();
    await Promise.all([firstWork, secondWork]);
    assert.deepEqual(entered, ['first', 'second'], 'the waiting tab enters after the verified lease is released');
    run(() => {
      first.destroy();
      second.destroy();
    });
  });

  test('malformed shared records and equal-millisecond generations are handled deterministically', function(assert) {
    let service = AuthSessionService.create({lockManager: {request(name, options, callback) {
      return resolve().then(callback);
    }}});
    let lower = '1726358400000.0' + '0'.repeat(63);
    let higher = '1726358400000.f' + 'f'.repeat(63);

    assert.strictEqual(parseRecord('{not-json'), null, 'invalid JSON is rejected');
    assert.strictEqual(parseRecord({generation: 'short', accountId: null, committedAt: 1}), null,
      'invalid generations are rejected');
    assert.ok(service.isNewer(higher, lower), 'the random suffix breaks timestamp ties consistently');
    assert.notOk(service.isNewer(lower, higher), 'the ordering cannot report both generations as newer');
    run(() => service.destroy());
  });

  test('resuming an older callback never relabels it as a newer in-memory login', function(assert) {
    let service = AuthSessionService.create({lockManager: {request(name, options, callback) {
      return resolve().then(callback);
    }}});
    let older = {
      baseGeneration: null,
      generation: '1726358400000.' + '1'.repeat(64),
      startedAt: 1726358400000,
    };
    let newer = {
      baseGeneration: null,
      generation: '1726358400001.' + '2'.repeat(64),
      startedAt: 1726358400001,
    };
    service.set('pendingLogin', newer);

    assert.strictEqual(service.resumeLogin(older).generation, older.generation,
      'the asynchronous callback keeps its original ownership generation');
    assert.strictEqual(service.get('pendingLogin').generation, newer.generation,
      'the newer local login remains the active pending transaction');
    run(() => service.destroy());
  });

  test('storage events report ownership changes without invoking logout', function(assert) {
    assert.expect(4);
    let originalLookup = window.lc;
    let generation = '1726358400000.' + 'a'.repeat(64);
    let record = {generation, accountId: '1a1', committedAt: 1726358400100};
    let service;
    window.lc = function(name) {
      assert.strictEqual(name, 'application', 'the existing application route receives the change');
      return {
        send(action, change) {
          assert.strictEqual(action, 'authSessionChanged', 'the event is reconciliation, never logout');
          assert.strictEqual(change.newRecord.generation, generation, 'the committed generation is forwarded');
          assert.deepEqual(Object.keys(change.newRecord).sort(), ['accountId', 'committedAt', 'generation'],
            'only non-sensitive metadata crosses tabs');
        },
      };
    };

    try {
      service = AuthSessionService.create({lockManager: {request(name, options, callback) {
        return resolve().then(callback);
      }}});
      // Invoke the service-owned listener directly.  The full Ember test app
      // can also have its singleton service alive; dispatching globally would
      // test both instances and double the assertions without adding coverage.
      service._storageHandler(new StorageEvent('storage', {
        key: C.AUTH_SESSION.STORAGE_KEY,
        oldValue: null,
        newValue: JSON.stringify(record),
        storageArea: window.localStorage,
      }));
    } finally {
      window.lc = originalLookup;
      if ( service ) {
        run(() => service.destroy());
      }
    }
  });
});
