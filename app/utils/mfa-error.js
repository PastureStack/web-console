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
  return value(err, 'code') || (body && body.code) ||
    value(err, 'type') || (body && body.type) || value(err, 'message');
}

export function localizedMfaError(err, intl, fallbackKey) {
  let key = TRANSLATION_KEYS[mfaErrorCode(err)];
  if ( key ) {
    return intl.t(key);
  }
  let body = parsedBody(err);
  let status = Number(value(err, 'status') || value(err, 'statusCode') ||
    (body && body.status) || (err && err.xhr && err.xhr.status));
  let code = mfaErrorCode(err);
  let details = [];
  if ( Number.isInteger(status) && status >= 400 && status <= 599 ) {
    details.push(`HTTP ${status}`);
  }
  // Show bounded API identifiers, never arbitrary response text or HTML.
  if ( typeof code === 'string' && code !== 'error' &&
       /^[A-Za-z][A-Za-z0-9_. -]{0,63}$/.test(code) &&
       (value(err, 'code') || (body && body.code)) ) {
    details.push(code);
  }
  let message = intl.t(fallbackKey || 'loginPage.mfa.error.invalid');
  return details.length ? `${message} (${details.join('; ')})` : message;
}
