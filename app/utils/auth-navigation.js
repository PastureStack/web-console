const SENSITIVE_QUERY_KEYS = [
  'access_token',
  'code',
  'id_token',
  'mfaCode',
  'otp',
  'state',
  'token',
];

export function safeInternalTarget(candidate, origin=window.location.origin) {
  if ( !candidate || typeof candidate !== 'string' ) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(candidate, origin);
  } catch (e) {
    return null;
  }

  if ( parsed.origin !== origin ) {
    return null;
  }

  let hasSensitiveValue = SENSITIVE_QUERY_KEYS.some((key) => {
    return parsed.searchParams.has(key);
  });
  if ( hasSensitiveValue ) {
    return null;
  }

  return parsed.pathname + parsed.search + parsed.hash;
}

export function isAuthenticationPath(path) {
  return /^\/(?:login|logout)(?:\/|$)/.test(path || '');
}
