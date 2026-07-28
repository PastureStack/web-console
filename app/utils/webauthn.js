function decodeBase64Url(value) {
  let normalized = (value || '').replace(/-/g, '+').replace(/_/g, '/');
  while ( normalized.length % 4 ) {
    normalized += '=';
  }

  let binary = window.atob(normalized);
  let bytes = new Uint8Array(binary.length);
  for ( let i = 0 ; i < binary.length ; i++ ) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeBase64Url(value) {
  if ( value === null || typeof value === 'undefined' ) {
    return null;
  }
  let bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer || value);
  let binary = '';
  for ( let i = 0 ; i < bytes.length ; i++ ) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isAvailable() {
  return typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials;
}

function ensureAvailable() {
  if ( !isAvailable() ) {
    throw new Error('WebAuthnUnavailable');
  }
}

function requestOptionsFromJson(options) {
  if ( window.PublicKeyCredential.parseRequestOptionsFromJSON ) {
    return window.PublicKeyCredential.parseRequestOptionsFromJSON(options);
  }
  let result = Object.assign({}, options);
  result.challenge = decodeBase64Url(result.challenge);
  result.allowCredentials = (result.allowCredentials || []).map((item) => {
    return Object.assign({}, item, {id: decodeBase64Url(item.id)});
  });
  return result;
}

function creationOptionsFromJson(options) {
  if ( window.PublicKeyCredential.parseCreationOptionsFromJSON ) {
    return window.PublicKeyCredential.parseCreationOptionsFromJSON(options);
  }
  let result = Object.assign({}, options);
  result.challenge = decodeBase64Url(result.challenge);
  result.user = Object.assign({}, result.user, {id: decodeBase64Url(result.user.id)});
  result.excludeCredentials = (result.excludeCredentials || []).map((item) => {
    return Object.assign({}, item, {id: decodeBase64Url(item.id)});
  });
  return result;
}

function responseJson(credential) {
  if ( credential && typeof credential.toJSON === 'function' ) {
    return JSON.stringify(credential.toJSON());
  }
  let response = credential.response;
  let result = {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults ?
      credential.getClientExtensionResults() : {},
    authenticatorAttachment: credential.authenticatorAttachment || null,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
    },
  };

  if ( response.authenticatorData ) {
    result.response.authenticatorData = encodeBase64Url(response.authenticatorData);
    result.response.signature = encodeBase64Url(response.signature);
    result.response.userHandle = encodeBase64Url(response.userHandle);
  } else {
    result.response.attestationObject = encodeBase64Url(response.attestationObject);
    result.response.transports = response.getTransports ? response.getTransports() : [];
  }
  return JSON.stringify(result);
}

export function authenticate(options) {
  ensureAvailable();
  return navigator.credentials.get({publicKey: requestOptionsFromJson(options)})
    .then(responseJson);
}

export function register(options) {
  ensureAvailable();
  return navigator.credentials.create({publicKey: creationOptionsFromJson(options)})
    .then(responseJson);
}
