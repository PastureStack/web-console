const QUERY_ERROR_KEYS = {
  result_set_too_large: 'tooLarge',
  export_too_large: 'exportTooLarge',
  invalid_time_scope: 'invalidRange',
  incomplete_time_range: 'invalidRange',
  invalid_time_range: 'invalidRange',
  time_range_too_large: 'invalidRange',
  InvalidAuditRange: 'invalidRange',
};

function field(value, key) {
  try {
    let direct = value[key];
    return direct === undefined && typeof value.get === 'function' ? value.get(key) : direct;
  } catch (e) {
    return undefined;
  }
}

function errorNodes(error, nodes = [], seen = [], depth = 0) {
  if ( depth > 4 || error === null || error === undefined ) {
    return nodes;
  }
  if ( typeof error === 'string' ) {
    // Error envelopes are small. Do not parse an unbounded HTML/text response.
    if ( error.length > 65536 ) { return nodes; }
    try { return errorNodes(JSON.parse(error), nodes, seen, depth + 1); } catch (e) { return nodes; }
  }
  if ( typeof error !== 'object' || seen.includes(error) ) {
    return nodes;
  }
  seen.push(error);
  nodes.push(error);
  // Match rawRequest, XHR and API error envelopes, never message/detail fields.
  ['body', 'responseJSON', 'response', 'xhr', 'data', 'responseText'].forEach((key) => {
    errorNodes(field(error, key), nodes, seen, depth + 1);
  });
  return nodes;
}

function safeStatus(nodes) {
  for (let node of nodes) {
    for (let key of ['status', 'statusCode']) {
      let candidate = field(node, key);
      if ( typeof candidate !== 'number' &&
           !(typeof candidate === 'string' && /^[1-5][0-9]{2}$/.test(candidate)) ) {
        continue;
      }
      let status = Number(candidate);
      if ( Number.isInteger(status) && status >= 100 && status <= 599 ) { return status; }
    }
  }
  return null;
}

export function isAuthenticationFailure(error) {
  return safeStatus(errorNodes(error)) === 401;
}

export function auditQueryError(error) {
  let nodes = errorNodes(error);
  let status = safeStatus(nodes);
  // The caller must rethrow the original 401 to the application's session flow.
  // Returning no presentation prevents an authentication failure becoming empty results.
  if ( status === 401 ) { return null; }

  let code = null;
  for (let node of nodes) {
    let candidate = field(node, 'code');
    if ( typeof candidate === 'string' && Object.prototype.hasOwnProperty.call(QUERY_ERROR_KEYS, candidate) ) {
      code = candidate;
      break;
    }
  }
  let key = status === 403 ? 'forbidden' : code ? QUERY_ERROR_KEYS[code] : 'unavailable';
  return {
    messageKey: `auditLogsPage.queryErrors.${key}`,
    canNarrow: ['tooLarge', 'exportTooLarge', 'invalidRange'].includes(key),
    status,
    code,
  };
}

export default auditQueryError;
