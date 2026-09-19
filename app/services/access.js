import { resolve, reject } from 'rsvp';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';
import { parseAttempt } from 'ui/services/auth-session';

export default Service.extend({
  cookies: service(),
  authSession: service('auth-session'),
  session: service(),
  github:  service(),
  shibbolethAuth: service(),
  store: service(),
  userStore: service('user-store'),

  token: null,
  mfaChallenge: null,
  loadedVersion: null,
  explicitLogoutPromise: null,

  // These are set by authenticated/route
  // Is access control enabled
  enabled: null,

  // What kind of access control
  provider: null,

  // Are you an admin
  admin: null,

  // The identity from the session isn't an actual identity model...
  identity: function() {
    var obj = this.get('session.'+C.SESSION.IDENTITY) || {};
    obj.type = 'identity';
    return this.get('userStore').createRecord(obj);
  }.property('session.'+C.SESSION.IDENTITY),

  testAuth(generation) {
    generation = generation || this.captureGeneration();
    // Do not hold the authentication mutex while a network request is in
    // flight.  A deliberately delayed response from an old session must be
    // allowed to overlap a newer login; the captured generation is checked
    // after the response settles.
    return this.get('userStore').rawRequest({
      url: '',
    }).then((xhr) => {
      let loaded = this.get('loadedVersion');
      let cur = xhr.headers.get(C.HEADER.RANCHER_VERSION);

      // Reload if the version changes
      if ( loaded && cur && loaded !== cur ) {
        window.location.href = window.location.href;
        return;
      }

      let shared = this.get('authSession').readShared();
      if ( generation && shared && shared.generation !== generation ) {
        return {status: 'stale', generation: shared.generation};
      }

      return {status: 'active', generation};
    });
  },

  detect() {
    if ( this.get('enabled') !== null ) {
      return resolve();
    }

    return this.get('userStore').rawRequest({
      url: 'token',
    })
    .then((xhr) => {
      var session = this.get('session');
      // If we get a good response back, the API supports authentication
      var token = xhr.body.data[0];

      var interesting = {};
      C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
        if (  typeof token[key] !== 'undefined' && typeof session.get(key) === 'undefined' )
        {
          interesting[key] = token[key];
        }
      });

      session.setProperties(interesting);

      this.setProperties({
        'enabled': token.security,
        'provider': (token.authProvider||'').toLowerCase(),
        'loadedVersion': xhr.headers.get(C.HEADER.RANCHER_VERSION),
      });

      this.set('token', token);

      if (this.shibbolethConfigured(token)) {
        this.get('shibbolethAuth').set('hasToken', token);
        this.get('session').set(C.SESSION.USER_TYPE, token.userType);
      } else if ( !token.security ) {
        this.clearSessionKeys();
      }

      return resolve(undefined,'API supports authentication'+(token.security ? '' : ', but is not enabled'));
    })
    .catch((err) => {
      // Otherwise this API is too old to do auth.
      this.set('enabled', false);
      this.set('app.initError', err);
      return resolve(undefined,'Error determining API authentication');
    });
  },

  shibbolethConfigured(token) {
    let rv = false;
    if ((token.authProvider||'') === 'shibbolethconfig' && token.userIdentity) {
      rv = true;
    }
    return rv;
  },

  login(code, providerOverride, options, suppliedAttempt) {
    let authSession = this.get('authSession');
    let attempt = suppliedAttempt ? authSession.resumeLogin(suppliedAttempt) : authSession.beginLogin();
    let request = Object.assign({}, options || {}, {
      code: code,
      authProvider: providerOverride || this.get('provider'),
      clientSessionId: attempt.generation,
    });
    return authSession.runExclusive(() => {
      if ( authSession.isAttemptSuperseded(attempt) ) {
        authSession.completeLogin(attempt.generation);
        return {superseded: true};
      }
      return {superseded: false};
    }).then((preflight) => {
      if ( preflight.superseded ) {
        return {body: null, authSessionAccepted: false, authSessionSuperseded: true};
      }
      return this.get('userStore').rawRequest({
      url: 'token',
      method: 'POST',
      data: request,
      });
    }).then((xhr) => {
      if ( xhr.authSessionSuperseded ) {
        return xhr;
      }
      if ( xhr.body && xhr.body.mfaRequired ) {
        return this._acceptMfaChallenge(xhr, attempt);
      } else {
        this.set('mfaChallenge', null);
        return this.acceptLogin(xhr.body, attempt).then((result) => {
          xhr.authSessionAccepted = result.accepted;
          xhr.authSessionSuperseded = result.superseded;
          return xhr;
        });
      }
      return xhr;
    }).catch((res) => this._handleLoginFailure(
      res, attempt, 'Error logging in'
    ));
  },

  completeMfa(data) {
    let attempt = this.get('authSession').currentLogin();
    return this.get('userStore').rawRequest({
      url: 'token',
      method: 'POST',
      data: Object.assign({}, data || {}, {
        authProvider: 'mfa',
        clientSessionId: attempt.generation,
      }),
    }).then((xhr) => {
      if ( xhr.body && xhr.body.mfaRequired ) {
        return this._acceptMfaChallenge(xhr, attempt);
      } else {
        this.set('mfaChallenge', null);
        return this.acceptLogin(xhr.body, attempt).then((result) => {
          xhr.authSessionAccepted = result.accepted;
          xhr.authSessionSuperseded = result.superseded;
          return xhr;
        });
      }
      return xhr;
    }).catch((res) => this._handleLoginFailure(
      res, attempt, 'Error verifying the security factor'
    ));
  },

  cancelMfa() {
    this.set('mfaChallenge', null);
    let attempt = this.get('authSession').get('pendingLogin');
    this.get('authSession').completeLogin(attempt && attempt.generation);
  },

  acceptLogin(auth, attempt) {
    if ( !auth || typeof auth.jwt !== 'string' || auth.jwt.trim().length === 0 ) {
      return reject(new Error('The login response did not contain a valid session token'));
    }

    attempt = parseAttempt(attempt || this.get('authSession').currentLogin());
    if ( !attempt ) {
      return reject(new Error('The login response was not associated with a valid authentication attempt'));
    }
    return this.get('authSession').runExclusive(() => {
      let authSession = this.get('authSession');
      let shared = authSession.readShared();

      // An older OIDC/MFA callback is never allowed to overwrite a login that
      // began later in another tab.
      if ( authSession.isAttemptSuperseded(attempt) ) {
        authSession.completeLogin(attempt.generation);
        return {accepted: false, superseded: true};
      }

      let previousCookie = this.get('cookies').get(C.COOKIE.TOKEN);
      let previousValues = this._sessionValues();
      let previousRecord = shared;
      let written = this._writeTokenCookie(auth.jwt);

      if ( !written || this.get('cookies').get(C.COOKIE.TOKEN) !== auth.jwt ) {
        this._restoreLocalSnapshot(previousCookie, previousValues);
        throw new Error('The browser refused the session cookie');
      }

      try {
        this._applyTokenMetadata(auth);
        authSession.commit(attempt.generation, auth.accountId, auth.jwt);
      } catch (e) {
        this._restoreLocalSnapshot(previousCookie, previousValues);
        if ( previousRecord ) {
          window.localStorage.setItem(C.AUTH_SESSION.STORAGE_KEY, JSON.stringify(previousRecord));
          authSession.adopt(previousRecord, previousCookie);
        } else {
          window.localStorage.removeItem(C.AUTH_SESSION.STORAGE_KEY);
          authSession.forget();
        }
        throw e;
      }

      authSession.completeLogin(attempt.generation);
      return {accepted: true, superseded: false};
    });
  },

  captureGeneration() {
    return this.get('authSession').capture();
  },

  ensureSession() {
    let cookie = this.get('cookies').get(C.COOKIE.TOKEN);
    if ( !cookie ) {
      return reject({status: 401, message: 'No session cookie'});
    }

    return this._readCurrentToken().then((token) => {
      return this.get('authSession').runExclusive(() => {
        if ( this.get('cookies').get(C.COOKIE.TOKEN) !== cookie ) {
          return reject({status: 409, message: 'Session changed during validation'});
        }

        let current = this.get('authSession').readShared();
        if ( !current ) {
          current = this.get('authSession').commit(
            this.get('authSession').createGeneration(), token.accountId, cookie
          );
        } else {
          this.get('authSession').adopt(current, cookie);
        }
        this._applyTokenMetadata(token);
        return {status: 'active', generation: current.generation};
      });
    });
  },

  adoptSharedSession() {
    let authSession = this.get('authSession');
    // Read the cookie and generation only after entering the same mutex used
    // by login commit.  Reading first allowed a peer notification to observe
    // the cookie write but miss the immediately following generation commit,
    // then incorrectly conclude that the new session was invalid.
    return authSession.runExclusive(() => {
      let shared = authSession.readShared();
      let cookie = this.get('cookies').get(C.COOKIE.TOKEN);
      if ( !shared || !cookie ) {
        this._clearOwnedLocalState(this.captureGeneration());
        return {status: 'invalid'};
      }
      return {status: 'validate', shared, cookie};
    }).then((outcome) => {
      if ( outcome.status !== 'validate' ) {
        return outcome;
      }
      return this._validateAndAdopt(outcome.shared, outcome.cookie);
    });
  },

  handlePassiveFailure(generation, status) {
    if ( status === 403 ) {
      return resolve({status: 'forbidden'});
    }

    let shared = this.get('authSession').readShared();
    let cookie = this.get('cookies').get(C.COOKIE.TOKEN);
    return this.get('authSession').runExclusive(() => {
      shared = this.get('authSession').readShared();
      cookie = this.get('cookies').get(C.COOKIE.TOKEN);
      if ( shared && !cookie && this.get('authSession').owns(shared.generation) ) {
        let snapshot = this.get('authSession.tokenSnapshot');
        if ( snapshot && this._writeTokenCookie(snapshot) &&
             this.get('cookies').get(C.COOKIE.TOKEN) === snapshot ) {
          cookie = snapshot;
          // A page running pre-fix JavaScript can remove this shared cookie
          // after the bound server DELETE was safely rejected.  Recommit the
          // same generation so other tabs receive a storage event only after
          // the owning tab has restored and read back the cookie.
          shared = this.get('authSession').commit(
            shared.generation, shared.accountId, snapshot
          );
        }
      }

      if ( !shared || !cookie ) {
        this._clearOwnedLocalState(generation);
        return {status: 'invalid'};
      }
      return {status: 'validate'};
    }).then((outcome) => {
      if ( outcome.status !== 'validate' ) {
        return outcome;
      }
      return this._validateAndAdopt(shared, cookie).then((validated) => {
        return validated.status === 'adopted' && generation === shared.generation ?
          {status: 'active', generation: validated.generation} : validated;
      }, (error) => {
        return this._errorStatus(error) === 403 ? {status: 'forbidden'} : reject(error);
      });
    });
  },

  explicitLogout() {
    if ( this.get('explicitLogoutPromise') ) {
      return this.get('explicitLogoutPromise');
    }

    let promise = this.get('authSession').runExclusive((lockGuard) => {
      let authSession = this.get('authSession');
      let generation = authSession.capture();
      let shared = authSession.readShared();
      let cookie = this.get('cookies').get(C.COOKIE.TOKEN);
      let snapshot = authSession.get('tokenSnapshot');

      if ( !generation || !shared || shared.generation !== generation ||
           !snapshot || cookie !== snapshot ) {
        if ( shared && cookie ) {
          return {status: 'stale'};
        }
        this._clearOwnedLocalState(generation);
        return {status: 'complete'};
      }

      // Keep the mutex until the response settles.  The server does not emit
      // an expiry cookie for bound sessions; this tab clears it only after it
      // has rechecked ownership below.
      return this.get('userStore').rawRequest({
        url: 'token/current',
        method: 'DELETE',
        headers: {
          [C.AUTH_SESSION.LOGOUT_HEADER]: generation,
        },
      }).then(() => lockGuard.assertOwned()).then(() => {
        let current = authSession.readShared();
        let currentCookie = this.get('cookies').get(C.COOKIE.TOKEN);
        if ( current && current.generation === generation && currentCookie === snapshot ) {
          this._clearOwnedLocalState(generation);
        }
        return {status: 'complete'};
      });
    });

    this.set('explicitLogoutPromise', promise);
    return promise.finally(() => {
      this.set('explicitLogoutPromise', null);
    });
  },

  clearToken() {
    return this.explicitLogout();
  },

  clearLocalSession(generation) {
    generation = generation || this.captureGeneration();
    return this.get('authSession').runExclusive(() => {
      let shared = this.get('authSession').readShared();
      if ( shared && (!generation || shared.generation !== generation) ) {
        return {status: 'stale', generation: shared.generation};
      }
      this._clearOwnedLocalState(generation);
      return {status: 'complete'};
    });
  },

  clearSessionKeys(all) {
    if ( all === true )
    {
      this.get('session').clear();
    }
    else
    {
      var values = {};
      C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
        values[key] = undefined;
      });

      this.get('session').setProperties(values);
    }

    this.get('cookies').remove(C.COOKIE.TOKEN);
  },

  suspendSession() {
    let session = this.get('session');
    let values = {};

    C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
      values[key] = session.get(key);
    });

    let snapshot = {
      token: this.get('cookies').get(C.COOKIE.TOKEN),
      values: values,
    };

    this.clearSessionKeys();
    return snapshot;
  },

  restoreSession(snapshot) {
    snapshot = snapshot || {};
    this.clearSessionKeys();
    this.get('session').setProperties(snapshot.values || {});

    if ( snapshot.token ) {
      this.get('cookies').setWithOptions(C.COOKIE.TOKEN, snapshot.token, {
        path: '/',
        secure: window.location.protocol === 'https:',
        sameSite: 'Lax',
      });
    }
  },

  isLoggedIn() {
    return !!this.get('cookies').get(C.COOKIE.TOKEN);
  },

  isOwner() {
    let schema = this.get('store').getById('schema','stack');
    if ( schema && schema.resourceFields.system ) {
      return schema.resourceFields.system.create;
    }

    return false;
  },

  _readCurrentToken() {
    return this.get('userStore').rawRequest({
      url: 'token',
    }).then((xhr) => {
      let data = xhr && xhr.body && xhr.body.data;
      let token = data && data[0];
      if ( !token ) {
        return reject({status: 401, message: 'No authenticated session'});
      }
      return token;
    });
  },

  _acceptMfaChallenge(xhr, attempt) {
    return this.get('authSession').runExclusive(() => {
      let authSession = this.get('authSession');
      if ( authSession.isAttemptSuperseded(attempt) ) {
        authSession.completeLogin(attempt.generation);
        xhr.authSessionAccepted = false;
        xhr.authSessionSuperseded = true;
        return xhr;
      }

      let current = this.get('mfaChallenge');
      let sameChallenge = current && current.mfaChallengeId &&
        current.mfaChallengeId === xhr.body.mfaChallengeId;
      this.set('mfaChallenge', sameChallenge ?
        Object.assign({}, current, xhr.body) : xhr.body);
      xhr.authSessionAccepted = false;
      xhr.authSessionSuperseded = false;
      return xhr;
    });
  },

  _validateAndAdopt(shared, cookie) {
    return this._readCurrentToken().then((token) => {
      return this.get('authSession').runExclusive(() => {
        let current = this.get('authSession').readShared();
        let currentCookie = this.get('cookies').get(C.COOKIE.TOKEN);
        if ( !current || current.generation !== shared.generation || currentCookie !== cookie ) {
          return {status: 'stale', generation: current && current.generation};
        }
        this.get('authSession').adopt(current, currentCookie);
        this._applyTokenMetadata(token);
        return {status: 'adopted', generation: current.generation};
      });
    }, (error) => {
      if ( this._errorStatus(error) !== 401 ) {
        return reject(error);
      }
      return this.get('authSession').runExclusive(() => {
        let current = this.get('authSession').readShared();
        let currentCookie = this.get('cookies').get(C.COOKIE.TOKEN);
        if ( current && current.generation === shared.generation && currentCookie === cookie ) {
          this._clearOwnedLocalState(shared.generation);
          return {status: 'invalid'};
        }
        return {status: 'stale', generation: current && current.generation};
      });
    });
  },

  _applyTokenMetadata(auth) {
    let interesting = {};
    C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
      if ( typeof auth[key] !== 'undefined' ) {
        interesting[key] = auth[key];
      }
    });
    this.get('session').setProperties(interesting);
  },

  _sessionValues() {
    let values = {};
    C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
      values[key] = this.get('session').get(key);
    });
    return values;
  },

  _writeTokenCookie(token) {
    return this.get('cookies').setWithOptions(C.COOKIE.TOKEN, token, {
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'Lax',
    });
  },

  _restoreLocalSnapshot(cookie, values) {
    this.get('session').setProperties(values || {});
    if ( cookie ) {
      this._writeTokenCookie(cookie);
    } else {
      this.get('cookies').remove(C.COOKIE.TOKEN, {path: '/'});
    }
  },

  _clearOwnedLocalState(generation) {
    let authSession = this.get('authSession');
    let shared = authSession.readShared();
    if ( shared && (!generation || shared.generation !== generation) ) {
      return false;
    }
    this.clearSessionKeys();
    authSession.removeShared(generation);
    authSession.forget(generation);
    return true;
  },

  _handleLoginFailure(response, attempt, fallbackMessage) {
    if ( this._isSupersededLoginError(response) ) {
      this.get('authSession').completeLogin(attempt && attempt.generation);
      return resolve({
        body: null,
        authSessionAccepted: false,
        authSessionSuperseded: true,
      });
    }

    let error = response && response.body ? response.body : response;
    if ( !error ) {
      error = {type: 'error', message: fallbackMessage};
    }
    return reject(error);
  },

  _isSupersededLoginError(error) {
    let status = this._errorStatus(error);
    let code = error && error.body && error.body.code;
    code = code || (error && error.responseJSON && error.responseJSON.code);
    code = code || (error && error.xhr && error.xhr.responseJSON &&
      error.xhr.responseJSON.code);
    code = code || (error && error.code);
    return code === 'ClientSessionSuperseded' && (!status || status === 409);
  },

  _errorStatus(error) {
    return error && error.xhr ? error.xhr.status : (error && error.status);
  },
});
