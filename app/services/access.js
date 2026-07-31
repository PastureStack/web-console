import { resolve, reject } from 'rsvp';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Service.extend({
  cookies: service(),
  session: service(),
  github:  service(),
  shibbolethAuth: service(),
  store: service(),
  userStore: service('user-store'),

  token: null,
  mfaChallenge: null,
  loadedVersion: null,

  // These are set by authenticated/route
  // Is access control enabled
  enabled: null,

  // What kind of access control
  provider: null,

  // Are you an admin
  admin: null,

  // The identity from the session isn't an actual identity model...
  identity: computed('session.'+C.SESSION.IDENTITY, function() {
    var obj = this.get('session.'+C.SESSION.IDENTITY) || {};
    obj.type = 'identity';
    return this.get('userStore').createRecord(obj);
  }),

  testAuth() {
    // make a call to api base because it is authenticated
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

      // Auth token still good
      return resolve('Auth Succeeded');
    }, (/* err */) => {
      // Auth token expired
      return reject('Auth Failed');
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

  login(code, providerOverride, options) {
    let request = Object.assign({
      code: code,
      authProvider: providerOverride || this.get('provider'),
    }, options || {});
    return this.get('userStore').rawRequest({
      url: 'token',
      method: 'POST',
      data: request,
    }).then((xhr) => {
      if ( xhr.body && xhr.body.mfaRequired ) {
        this.set('mfaChallenge', xhr.body);
      } else {
        this.set('mfaChallenge', null);
        this.acceptLogin(xhr.body);
      }
      return xhr;
    }).catch((res) => {
      let err;
      try {
        err = res.body;
      } catch(e) {
        err = {type: 'error', message: 'Error logging in'};
      }
      return reject(err);
    });
  },

  completeMfa(data) {
    return this.get('userStore').rawRequest({
      url: 'token',
      method: 'POST',
      data: Object.assign({
        authProvider: 'mfa',
      }, data || {}),
    }).then((xhr) => {
      if ( xhr.body && xhr.body.mfaRequired ) {
        let current = this.get('mfaChallenge');
        let sameChallenge = current && current.mfaChallengeId &&
          current.mfaChallengeId === xhr.body.mfaChallengeId;
        this.set('mfaChallenge', sameChallenge ?
          Object.assign({}, current, xhr.body) : xhr.body);
      } else {
        this.set('mfaChallenge', null);
        this.acceptLogin(xhr.body);
      }
      return xhr;
    }).catch((res) => {
      let err;
      try {
        err = res.body;
      } catch(e) {
        err = {type: 'error', message: 'Error verifying the security factor'};
      }
      return reject(err);
    });
  },

  cancelMfa() {
    this.set('mfaChallenge', null);
  },

  acceptLogin(auth) {
    var session = this.get('session');
    var interesting = {};
    C.TOKEN_TO_SESSION_KEYS.forEach((key) => {
      if ( typeof auth[key] !== 'undefined' )
      {
        interesting[key] = auth[key];
      }
    });

    this.get('cookies').setWithOptions(C.COOKIE.TOKEN, auth['jwt'], {
      path: '/',
      secure: window.location.protocol === 'https:'
    });
    session.setProperties(interesting);
  },

  clearToken() {
    return this.get('userStore').rawRequest({
      url: 'token/current',
      method: 'DELETE',
    }).then(() => {
      return true;
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
        secure: window.location.protocol === 'https:'
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
  }
});
