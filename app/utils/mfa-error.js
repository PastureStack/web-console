const TRANSLATION_KEYS = {
  AdministratorMfaEnrollmentRequired: 'loginPage.mfa.error.administratorFactorRequired',
  MfaFactorRequired: 'loginPage.mfa.error.factorRequired',
  MfaTemporarilyLocked: 'loginPage.mfa.error.locked',
  MfaVerificationFailed: 'loginPage.mfa.error.invalid',
  PasskeyCounterInvalid: 'loginPage.mfa.error.passkeyCounter',
  PasskeyLimitReached: 'loginPage.mfa.error.passkeyLimit',
  WebAuthnUnavailable: 'loginPage.mfa.error.secureContext',
};

function value(err, key) {
  if ( !err ) {
    return undefined;
  }
  if ( typeof err.get === 'function' ) {
    let result = err.get(key);
    if ( result !== undefined ) {
      return result;
    }
  }
  return err[key];
}

function parsedBody(err) {
  let body = value(err, 'body');
  if ( typeof body === 'string' ) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return body || value(err, 'xhr.responseJSON') ||
    (err && err.xhr && err.xhr.responseJSON) || null;
}

export function mfaErrorCode(err) {
  let body = parsedBody(err);
  return value(err, 'code') || value(err, 'type') ||
    (body && (body.code || body.type)) || value(err, 'message');
}

export function localizedMfaError(err, intl, fallbackKey) {
  let key = TRANSLATION_KEYS[mfaErrorCode(err)];
  if ( key ) {
    return intl.t(key);
  }
  return value(err, 'message') ||
    intl.t(fallbackKey || 'loginPage.mfa.error.invalid');
}
