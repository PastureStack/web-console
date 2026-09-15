import Service from '@ember/service';
import { Promise, reject, resolve } from 'rsvp';
import C from 'ui/utils/constants';

const GENERATION_RE = /^\d{13}\.[0-9a-f]{64}$/;
const LOCK_STORE = 'locks';
const LOCK_LEASE_MS = 30000;
const LOCK_RETRY_MS = 25;

function randomHex(bytes) {
  let crypto = window.crypto;
  if ( !crypto || typeof crypto.getRandomValues !== 'function' ) {
    throw new Error('Secure random generation is unavailable');
  }

  let values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.prototype.map.call(values, (value) => {
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function parseRecord(value) {
  if ( !value ) {
    return null;
  }

  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    return null;
  }

  if ( !parsed || !GENERATION_RE.test(parsed.generation || '') ||
       !Number.isFinite(parsed.committedAt) ||
       (parsed.accountId !== null && typeof parsed.accountId !== 'string') ) {
    return null;
  }

  return {
    generation: parsed.generation,
    accountId: parsed.accountId,
    committedAt: parsed.committedAt,
  };
}

function generationStartedAt(generation) {
  if ( !GENERATION_RE.test(generation || '') ) {
    return 0;
  }
  return Number(generation.slice(0, 13));
}

function parseAttempt(value) {
  if ( !value || !GENERATION_RE.test(value.generation || '') ||
       (value.baseGeneration !== null && value.baseGeneration !== undefined &&
        !GENERATION_RE.test(value.baseGeneration)) ||
       !Number.isFinite(value.startedAt) ) {
    return null;
  }

  return {
    baseGeneration: value.baseGeneration || null,
    generation: value.generation,
    startedAt: value.startedAt,
  };
}

export { GENERATION_RE, parseRecord, parseAttempt, generationStartedAt };

export default Service.extend({
  tabGeneration: null,
  tokenSnapshot: null,
  accountId: null,
  pendingLogin: null,
  lockManager: undefined,

  init() {
    this._super(...arguments);
    this._storageHandler = (event) => {
      if ( event.key !== C.AUTH_SESSION.STORAGE_KEY || event.oldValue === event.newValue ) {
        return;
      }

      let change = {
        oldRecord: parseRecord(event.oldValue),
        newRecord: parseRecord(event.newValue),
      };

      try {
        window.lc('application').send('authSessionChanged', change);
      } catch (e) {
        // The application route may not exist yet during initial boot.  The
        // authenticated route will reconcile the shared cookie before use.
      }
    };
    window.addEventListener('storage', this._storageHandler);
  },

  willDestroy() {
    window.removeEventListener('storage', this._storageHandler);
    this._storageHandler = null;
    this._super(...arguments);
  },

  createGeneration() {
    return String(Date.now()).padStart(13, '0') + '.' + randomHex(32);
  },

  beginLogin() {
    let shared = this.readShared();
    let attempt = {
      baseGeneration: shared ? shared.generation : null,
      generation: this.createGeneration(),
      startedAt: Date.now(),
    };
    this.set('pendingLogin', attempt);
    return attempt;
  },

  currentLogin() {
    return this.get('pendingLogin') || this.beginLogin();
  },

  resumeLogin(attempt) {
    attempt = parseAttempt(attempt);
    if ( !attempt ) {
      throw new Error('Invalid authentication attempt');
    }

    let current = this.get('pendingLogin');
    if ( !current || current.generation === attempt.generation ||
         this.isNewer(attempt.generation, current.generation) ) {
      this.set('pendingLogin', attempt);
    }

    // The caller must continue to carry the generation that was captured by
    // its own OIDC/MFA transaction.  Returning a newer in-memory attempt here
    // would relabel a late callback and allow it to pass the stale check.
    return attempt;
  },

  completeLogin(generation) {
    let current = this.get('pendingLogin');
    if ( generation && current && current.generation !== generation ) {
      return false;
    }
    this.set('pendingLogin', null);
    return true;
  },

  isAttemptSuperseded(attempt) {
    attempt = parseAttempt(attempt);
    if ( !attempt ) {
      return true;
    }

    let shared = this.readShared();
    return !!(shared && shared.generation !== attempt.baseGeneration &&
      shared.generation !== attempt.generation &&
      this.isNewer(shared.generation, attempt.generation));
  },

  capture() {
    return this.get('tabGeneration');
  },

  owns(generation) {
    return !!generation && this.get('tabGeneration') === generation;
  },

  readShared() {
    return parseRecord(window.localStorage.getItem(C.AUTH_SESSION.STORAGE_KEY));
  },

  commit(generation, accountId, tokenSnapshot) {
    let previous = this.readShared();
    let record = {
      generation,
      accountId: accountId === undefined || accountId === null ? null : String(accountId),
      // Keep recommits observable even when two writes land in the same
      // millisecond; storage events are suppressed when the serialized value
      // is identical.
      committedAt: Math.max(Date.now(), previous ? previous.committedAt + 1 : 0),
    };
    window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify(record));
    this.adopt(record, tokenSnapshot);
    return record;
  },

  adopt(record, tokenSnapshot) {
    record = parseRecord(record);
    if ( !record ) {
      throw new Error('Invalid shared authentication session');
    }
    let pending = this.get('pendingLogin');
    this.setProperties({
      tabGeneration: record.generation,
      tokenSnapshot,
      accountId: record.accountId,
      pendingLogin: pending && this.isNewer(pending.generation, record.generation) ? pending : null,
    });
    return record;
  },

  forget(generation) {
    if ( generation && !this.owns(generation) ) {
      return false;
    }
    this.setProperties({
      tabGeneration: null,
      tokenSnapshot: null,
      accountId: null,
      pendingLogin: null,
    });
    return true;
  },

  removeShared(generation) {
    let shared = this.readShared();
    if ( shared && (!generation || shared.generation === generation) ) {
      window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
      return true;
    }
    return false;
  },

  isNewer(left, right) {
    let leftStarted = generationStartedAt(left);
    let rightStarted = generationStartedAt(right);

    if ( leftStarted !== rightStarted ) {
      return leftStarted > rightStarted;
    }

    // Date.now() can be identical in two tabs.  The random suffix gives us a
    // deterministic total order so that two callbacks can never both decide
    // they are the newest session.
    return String(left || '') > String(right || '');
  },

  runExclusive(callback) {
    let manager = this.get('lockManager');
    if ( manager === undefined ) {
      manager = window.navigator && window.navigator.locks;
    }

    if ( manager && typeof manager.request === 'function' ) {
      return manager.request(C.AUTH_SESSION.LOCK_NAME, {mode: 'exclusive'}, () => {
        return callback({assertOwned: () => resolve(true)});
      });
    }

    return this._runIndexedDbExclusive(callback);
  },

  _openLockDatabase() {
    if ( !window.indexedDB ) {
      return reject(new Error('Cross-tab authentication mutex is unavailable'));
    }

    if ( this._lockDatabasePromise ) {
      return this._lockDatabasePromise;
    }

    this._lockDatabasePromise = new Promise((resolveDb, rejectDb) => {
      let request = window.indexedDB.open(C.AUTH_SESSION.LOCK_DATABASE, 1);
      request.onupgradeneeded = () => {
        let db = request.result;
        if ( !db.objectStoreNames.contains(LOCK_STORE) ) {
          db.createObjectStore(LOCK_STORE, {keyPath: 'name'});
        }
      };
      request.onsuccess = () => resolveDb(request.result);
      request.onerror = () => rejectDb(request.error || new Error('Unable to open authentication mutex database'));
      request.onblocked = () => rejectDb(new Error('Authentication mutex database is blocked'));
    });
    return this._lockDatabasePromise;
  },

  _claimIndexedDbLock(db, owner) {
    return new Promise((resolveClaim, rejectClaim) => {
      let transaction = db.transaction(LOCK_STORE, 'readwrite');
      let store = transaction.objectStore(LOCK_STORE);
      let request = store.get(C.AUTH_SESSION.LOCK_NAME);
      let claimed = false;

      request.onsuccess = () => {
        let current = request.result;
        let now = Date.now();
        if ( !current || !Number.isFinite(current.expiresAt) || current.expiresAt <= now ) {
          store.put({
            name: C.AUTH_SESSION.LOCK_NAME,
            owner,
            expiresAt: now + LOCK_LEASE_MS,
          });
          claimed = true;
        }
      };
      transaction.oncomplete = () => resolveClaim(claimed);
      transaction.onerror = () => rejectClaim(transaction.error || new Error('Unable to claim authentication mutex'));
      transaction.onabort = () => rejectClaim(transaction.error || new Error('Authentication mutex transaction aborted'));
    });
  },

  _renewIndexedDbLock(db, owner) {
    return new Promise((resolveRenew) => {
      let transaction = db.transaction(LOCK_STORE, 'readwrite');
      let store = transaction.objectStore(LOCK_STORE);
      let request = store.get(C.AUTH_SESSION.LOCK_NAME);
      let renewed = false;
      request.onsuccess = () => {
        let current = request.result;
        if ( current && current.owner === owner ) {
          current.expiresAt = Date.now() + LOCK_LEASE_MS;
          store.put(current);
          renewed = true;
        }
      };
      transaction.oncomplete = () => resolveRenew(renewed);
      transaction.onerror = () => resolveRenew(false);
      transaction.onabort = () => resolveRenew(false);
    });
  },

  _ownsIndexedDbLock(db, owner) {
    return new Promise((resolveOwnership) => {
      let transaction = db.transaction(LOCK_STORE, 'readonly');
      let request = transaction.objectStore(LOCK_STORE).get(C.AUTH_SESSION.LOCK_NAME);
      request.onsuccess = () => {
        let current = request.result;
        resolveOwnership(!!(current && current.owner === owner &&
          Number.isFinite(current.expiresAt) && current.expiresAt > Date.now()));
      };
      request.onerror = () => resolveOwnership(false);
    });
  },

  _releaseIndexedDbLock(db, owner) {
    return new Promise((resolveRelease) => {
      let transaction = db.transaction(LOCK_STORE, 'readwrite');
      let store = transaction.objectStore(LOCK_STORE);
      let request = store.get(C.AUTH_SESSION.LOCK_NAME);
      request.onsuccess = () => {
        let current = request.result;
        if ( current && current.owner === owner ) {
          store.delete(C.AUTH_SESSION.LOCK_NAME);
        }
      };
      transaction.oncomplete = () => resolveRelease();
      transaction.onerror = () => resolveRelease();
      transaction.onabort = () => resolveRelease();
    });
  },

  _waitForLock() {
    return new Promise((resolveWait) => {
      window.setTimeout(resolveWait, LOCK_RETRY_MS);
    });
  },

  _acquireIndexedDbLock(db, owner) {
    return this._claimIndexedDbLock(db, owner).then((claimed) => {
      if ( claimed ) {
        return true;
      }
      return this._waitForLock().then(() => this._acquireIndexedDbLock(db, owner));
    });
  },

  _runIndexedDbExclusive(callback) {
    let owner;
    try {
      owner = this.createGeneration() + '.' + randomHex(8);
    } catch (e) {
      return reject(e);
    }

    return this._openLockDatabase().then((db) => {
      return this._acquireIndexedDbLock(db, owner).then(() => {
        let leaseLost = false;
        let renewTimer = window.setInterval(() => {
          this._renewIndexedDbLock(db, owner).then((renewed) => {
            leaseLost = leaseLost || !renewed;
          });
        }, Math.floor(LOCK_LEASE_MS / 3));

        let guard = {
          assertOwned: () => {
            if ( leaseLost ) {
              return reject(new Error('Cross-tab authentication mutex ownership was lost'));
            }
            return this._ownsIndexedDbLock(db, owner).then((owned) => {
              if ( !owned ) {
                throw new Error('Cross-tab authentication mutex ownership was lost');
              }
              return true;
            });
          },
        };

        let result;
        try {
          result = callback(guard);
        } catch (e) {
          result = reject(e);
        }

        return resolve(result).then((value) => {
          return guard.assertOwned().then(() => value);
        }).then((value) => {
          window.clearInterval(renewTimer);
          return this._releaseIndexedDbLock(db, owner).then(() => value);
        }, (error) => {
          window.clearInterval(renewTimer);
          return this._releaseIndexedDbLock(db, owner).then(() => reject(error));
        });
      });
    });
  },
});
