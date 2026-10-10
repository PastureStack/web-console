export const API_KEY_OPERATIONS = ['read', 'create', 'update', 'upgrade', 'delete', 'exec', 'logs', 'export'];
export const API_KEY_MODES = ['full', 'closed', 'custom'];
export const API_KEY_RESOURCE_TYPES = ['stack', 'service', 'container', 'host', 'volume', 'network', 'secret', 'certificate',
  'project', 'setting', 'userPreference', 'registry', 'storagePool', 'networkPolicy', 'projectMember',
  'apiKey', 'apiKeyRestricted', 'account', 'auditLog'];

export function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function initialPolicy(value) {
  let policy = plain(value) || {mode: 'full', defaultEffect: 'allow', expiresAt: null, rules: []};
  return Object.assign({mode: 'full', defaultEffect: policy.mode === 'full' ? 'allow' : 'deny', expiresAt: null, rules: []}, policy);
}

export function policyErrors(policy, now = Date.now()) {
  let errors = [];
  if ( !policy || !API_KEY_MODES.includes(policy.mode) ) {
    return ['mode'];
  }
  if ( policy.expiresAt != null && (!Number.isFinite(Date.parse(policy.expiresAt)) || Date.parse(policy.expiresAt) <= now) ) {
    errors.push('expiry');
  }
  if ( policy.defaultEffect != null && ((policy.mode === 'full' && policy.defaultEffect !== 'allow') ||
    (policy.mode === 'closed' && policy.defaultEffect !== 'deny')) ) { errors.push('effect'); }
  if ( policy.mode !== 'custom' ) {
    return errors;
  }
  if ( !['allow', 'deny'].includes(policy.defaultEffect) ) {
    errors.push('effect');
  }
  let ids = new Set();
  (policy.rules || []).forEach((rule) => {
    if ( !rule.id || ids.has(rule.id) ) {
      errors.push('ruleId');
    }
    ids.add(rule.id);
    if ( !['allow', 'deny'].includes(rule.effect) ) {
      errors.push('effect');
    }
    let scope = rule.scope || {};
    if ( !['global', 'project', 'stack', 'resource'].includes(scope.kind) ||
      (scope.kind !== 'global' && !scope.resourceId) ||
      (scope.kind === 'resource' && !API_KEY_RESOURCE_TYPES.includes(scope.resourceType)) ) {
      errors.push('scope');
    }
    if ( !Array.isArray(rule.operations) || !rule.operations.length ||
      rule.operations.some((operation) => !API_KEY_OPERATIONS.includes(operation)) ) {
      errors.push('operation');
    }
  });
  return [...new Set(errors)];
}

export function localExpiry(iso) {
  if ( !iso ) {
    return '';
  }
  let date = new Date(iso);
  if ( !Number.isFinite(date.getTime()) ) {
    return '';
  }
  let local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function expiryIso(local) {
  let date = new Date(local);
  return local && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function policiesEqual(left, right) {
  function canonical(value) {
    let policy = initialPolicy(value);
    return {mode: policy.mode, expiresAt: policy.expiresAt ? (Number.isFinite(Date.parse(policy.expiresAt)) ? Date.parse(policy.expiresAt) : 'INVALID') : null,
      defaultEffect: policy.mode === 'custom' ? policy.defaultEffect : null,
      rules: policy.mode === 'custom' ? policy.rules.map((rule) => ({
        id: rule.id, effect: rule.effect, scope: {kind: rule.scope.kind,
          resourceType: canonicalResourceType(rule.scope.resourceType) || null, resourceId: rule.scope.resourceId || null},
        operations: rule.operations.slice().sort(),
      })).sort((a, b) => a.id.localeCompare(b.id)) : []};
  }
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function canonicalResourceType(type) {
  return ({instance: 'container', environment: 'stack', apiKeyRestricted: 'apiKey'})[type] || type;
}

export function apiKeyError(err) {
  let body = err && (err.body || (err.xhr && err.xhr.responseJSON)) || {};
  if ( typeof body === 'string' ) {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  let status = Number(err && (err.status || err.statusCode || (err.xhr && err.xhr.status)) || body.status);
  let candidate = body.code || err && err.code;
  let code = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(candidate || '') ? candidate : null;
  let requestId = /^[A-Za-z0-9_.:-]{1,128}$/.test(body.requestId || '') ? body.requestId : null;
  return {status, code, requestId, body};
}
