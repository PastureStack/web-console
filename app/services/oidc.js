import Service, { service } from '@ember/service';
import { resolve } from 'rsvp';
import C from 'ui/utils/constants';
import sha256Ascii from 'ui/utils/sha256';
import Util from 'ui/utils/util';

const TRANSACTION_TTL = 10 * 60 * 1000;

function base64Url(bytes) {
  let binary = '';
  for ( let i = 0 ; i < bytes.length ; i++ ) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomValue(length) {
  if ( !window.crypto || !window.crypto.getRandomValues ) {
    throw new Error('Secure random number generation is unavailable');
  }

  let bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function pkceChallenge(verifier) {
  if ( !window.crypto || !window.crypto.subtle ) {
    return resolve(base64Url(sha256Ascii(verifier)));
  }

  let bytes = new Uint8Array(verifier.length);
  for ( let i = 0 ; i < verifier.length ; i++ ) {
    bytes[i] = verifier.charCodeAt(i);
  }

  return window.crypto.subtle.digest('SHA-256', bytes).then((digest) => {
    return base64Url(new Uint8Array(digest));
  });
}

export default Service.extend({
  access: service(),
  authStore: service('auth-store'),
  intl: service(),
  settings: service(),
  'tab-session': service('tab-session'),
  userStore: service('user-store'),

  callbackUrl: function(token) {
    let tokenUrl = token && token.callbackUrl ? token.callbackUrl : this.get('access.token.callbackUrl');
    if ( tokenUrl ) {
      return tokenUrl;
    }

    let base = this.get('settings').get(C.SETTING.API_HOST) || window.location.origin;
    return `${base.replace(/\/+$/, '')}/login/oidc-auth`;
  },

  getToken: function() {
    return this.get('userStore').rawRequest({
      url: 'token',
    }).then((xhr) => {
      return xhr.body.data[0];
    });
  },

  prepare: function(config) {
    return this.get('authStore').rawRequest({
      url: 'redirectUrl',
      method: 'POST',
      data: config,
    }).then((xhr) => xhr.body);
  },

  test: function(config, code) {
    return this.get('authStore').rawRequest({
      url: 'testlogin',
      method: 'POST',
      data: {
        type: 'testAuthConfig',
        authConfig: config.serialize(),
        code: code,
      },
    }).then((xhr) => xhr.body);
  },

  createTransaction: function(pkceEnabled) {
    let transaction = {
      createdAt: Date.now(),
      nonce: randomValue(32),
      state: randomValue(32),
    };

    if ( !pkceEnabled ) {
      return resolve(transaction);
    }

    transaction.codeVerifier = randomValue(32);
    return pkceChallenge(transaction.codeVerifier).then((challenge) => {
      transaction.codeChallenge = challenge;
      return transaction;
    });
  },

  getAuthorizeUrl: function(preparedToken) {
    let token = preparedToken || this.get('access.token');
    let tokenPromise = token && token.redirectUrl ? resolve(token) : this.getToken();

    return tokenPromise.then((currentToken) => {
      this.get('access').set('token', currentToken);

      if ( !currentToken.redirectUrl ) {
        throw new Error(this.get('intl').t('loginOidc.error.missingRedirect'));
      }

      let pkceEnabled = currentToken.pkceEnabled !== false && currentToken.pkceEnabled !== 'false';
      return this.createTransaction(pkceEnabled).then((transaction) => {
        this.get('tab-session').set(C.TABSESSION.OIDC_TRANSACTION, transaction);

        let params = {
          state: transaction.state,
          nonce: transaction.nonce,
        };

        if ( transaction.codeChallenge ) {
          params.code_challenge = transaction.codeChallenge;
          params.code_challenge_method = 'S256';
        }

        let callbackUrl = this.callbackUrl(currentToken);
        if ( callbackUrl && !/[?&]redirect_uri=/.test(currentToken.redirectUrl) ) {
          params.redirect_uri = callbackUrl;
        }

        return Util.addQueryParams(currentToken.redirectUrl, params);
      });
    });
  },

  consumeAuthorization: function(params) {
    let transaction = this.get('tab-session').get(C.TABSESSION.OIDC_TRANSACTION);
    this.get('tab-session').set(C.TABSESSION.OIDC_TRANSACTION, undefined);

    if ( params.error ) {
      throw new Error(params.errorDescription || params.error);
    }

    if ( !transaction ) {
      throw new Error(this.get('intl').t('loginOidc.error.missingTransaction'));
    }

    if ( Date.now() - transaction.createdAt > TRANSACTION_TTL ) {
      throw new Error(this.get('intl').t('loginOidc.error.expired'));
    }

    if ( !params.state || params.state !== transaction.state ) {
      throw new Error(this.get('intl').t('loginOidc.error.stateMismatch'));
    }

    if ( !params.code ) {
      throw new Error(this.get('intl').t('loginOidc.error.missingCode'));
    }

    return JSON.stringify({
      authorizationCode: params.code,
      codeVerifier: transaction.codeVerifier || '',
      nonce: transaction.nonce,
    });
  },

  authorizeRedirect: function() {
    return this.getAuthorizeUrl(null).then((url) => {
      window.location.assign(url);
    });
  },

  authorizeTest: function(preparedToken, cb) {
    let responded = false;
    let timer = null;
    let popup = window.open('about:blank', 'pasturestackOidcAuth', Util.popupWindowOptions());

    if ( !popup ) {
      cb({type: 'error', message: this.get('intl').t('loginOidc.error.popupBlocked')});
      return;
    }

    let finish = (err, code) => {
      if ( responded ) {
        return;
      }

      responded = true;
      if ( timer ) {
        clearInterval(timer);
      }
      window.onOidcTest = undefined;
      cb(err, code);
    };

    window.onOidcTest = (error, errorDescription, code, state) => {
      try {
        let payload = this.consumeAuthorization({
          code: code,
          error: error,
          errorDescription: errorDescription,
          state: state,
        });
        finish(null, payload);
      } catch (err) {
        finish(err);
      }
    };

    timer = setInterval(() => {
      if ( popup.closed ) {
        finish({type: 'error', message: this.get('intl').t('loginOidc.error.cancelled')});
      }
    }, 500);

    this.getAuthorizeUrl(preparedToken).then((url) => {
      popup.location.replace(url);
    }).catch((err) => {
      popup.close();
      finish(err);
    });
  },
});
