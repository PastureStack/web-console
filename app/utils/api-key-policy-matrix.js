import { API_KEY_OPERATIONS, API_KEY_RESOURCE_TYPES, canonicalResourceType } from 'ui/utils/api-key-policy';
import { scopeKey } from 'ui/utils/api-key-owner-capabilities';
import { selectionMatches } from 'ui/utils/api-key-scope-selection';

export const POLICY_MATRIX_STATES = ['allow', 'deny', 'mixed', 'conditional', 'unknown'];
export const POLICY_MATRIX_BASIS = ['full', 'closed', 'expired', 'defaultAllow', 'defaultDeny', 'ruleAllow', 'explicitDeny',
  'scopeExceptions', 'unknownEvidence', 'unknownOverlap', 'invalidPolicy', 'createDestination', 'multipleTargets'];

// Engine ApiKeyTargetResolver's explicit type sets, not guesses from absent fields.
const PROJECT_ONLY = ['host', 'network', 'secret', 'certificate', 'registry', 'storagepool',
  'storagepoolhostmap', 'networkpolicy', 'projectmember'];
const PLATFORM = ['schema', 'setting', 'userpreference', 'apikey', 'auditlog'];
const STACK_CHILDREN = ['service', 'container', 'volume'];
const MULTI_TARGET_WRITES = ['update', 'upgrade', 'delete'];
const text = (value) => typeof value === 'string' ? value.trim() : '';
const identifier = (value) => !!text(value) && value === text(value);
// Same internal case/alias normalization as owner-capabilities; wire types stay unchanged.
const type = (value) => {
  let normalized = typeof value === 'string' ? (canonicalResourceType(value) || '').toLowerCase() : '';
  return ({instance: 'container', environment: 'stack', apikeyrestricted: 'apikey'})[normalized] || normalized;
};
const field = (value, name) => value && (typeof value.get === 'function' ? value.get(name) : value[name]);

function validScope(scope) {
  if ( !scope || !['global', 'project', 'stack', 'resource'].includes(scope.kind) ) { return false; }
  if ( scope.kind === 'global' ) { return scope.resourceId == null && scope.resourceType == null; }
  return identifier(scope.resourceId) && (scope.kind === 'resource' ?
    identifier(scope.resourceType) && API_KEY_RESOURCE_TYPES.includes(canonicalResourceType(scope.resourceType)) : scope.resourceType == null);
}

function expiryTimestamp(value) {
  if ( value == null ) { return null; }
  // A local wall-clock value is not an Instant. Normal UI DTOs are explicit UTC.
  if ( typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ) { return NaN; }
  return Date.parse(value);
}

function validPolicy(policy) {
  if ( !policy || !['full', 'closed', 'custom'].includes(policy.mode) ) { return false; }
  if ( policy.mode !== 'custom' ) {
    // Editor mode switches retain inactive custom rules until review normalizes them.
    return policy.defaultEffect == null || policy.defaultEffect === (policy.mode === 'full' ? 'allow' : 'deny');
  }
  if ( !['allow', 'deny'].includes(policy.defaultEffect) || !Array.isArray(policy.rules) || policy.rules.length > 128 ) { return false; }
  let ids = new Set();
  return policy.rules.every((rule) => {
    if ( !rule || !identifier(rule.id) || ids.has(rule.id) || !['allow', 'deny'].includes(rule.effect) || !validScope(rule.scope) ||
      !Array.isArray(rule.operations) || !rule.operations.length || rule.operations.length > 64 ||
      new Set(rule.operations).size !== rule.operations.length || rule.operations.some((operation) => !API_KEY_OPERATIONS.includes(operation)) ) { return false; }
    ids.add(rule.id);
    return true;
  });
}

function namedEvidence(scope, evidence) {
  if ( !selectionMatches(scope, evidence) || evidence.selectionLabel.trim() === scope.resourceId ||
    evidence.selectionLabel.trim() === scopeKey(scope) ) { return null; }
  let resource = evidence.resource || {};
  let expectedType = scope.kind === 'resource' ? type(scope.resourceType) : scope.kind;
  if ( field(resource, 'id') !== scope.resourceId || type(field(resource, 'type')) !== expectedType ) { return null; }
  let projectId = identifier(evidence.projectId) ? evidence.projectId : null;
  let accountId = identifier(field(resource, 'accountId')) ? field(resource, 'accountId') : null;
  let directStack = identifier(field(resource, 'stackId')) ? field(resource, 'stackId') : null;
  let selectedStack = identifier(evidence.stackId) ? evidence.stackId : null;
  if ( selectedStack && directStack && selectedStack !== directStack ) { return null; }
  let result = {label: evidence.selectionLabel.trim(), projectId: null, projectKnown: false,
    stackId: null, stackKnown: false, targetKnown: true};
  if ( expectedType === 'project' ) {
    // Resolver's Project Account target belongs to its own project, not PLATFORM.
    if ( projectId && projectId !== scope.resourceId || selectedStack || directStack ) { return null; }
    return Object.assign(result, {projectId: scope.resourceId, projectKnown: true, stackKnown: true});
  }
  if ( PLATFORM.includes(expectedType) ) {
    return Object.assign(result, {projectKnown: true, stackKnown: true});
  }
  if ( expectedType === 'account' ) {
    // Account may be a project Account. Its kind is intentionally not in the
    // evidence whitelist: exact identity is known, but ancestry remains unknown.
    return result;
  }
  if ( projectId && accountId && projectId !== accountId ) { return null; }
  result.projectId = projectId || accountId;
  result.projectKnown = !!result.projectId;
  result.targetKnown = result.projectKnown;
  if ( expectedType === 'stack' ) {
    if ( selectedStack && selectedStack !== scope.resourceId || directStack && directStack !== scope.resourceId ) { return null; }
    return Object.assign(result, {stackId: scope.resourceId, stackKnown: true});
  }
  if ( PROJECT_ONLY.includes(expectedType) ) {
    if ( selectedStack || directStack ) { return null; }
    return Object.assign(result, {stackKnown: true});
  }
  if ( STACK_CHILDREN.includes(expectedType) ) {
    if ( expectedType === 'container' || evidence.stackContextStatus != null ) {
      if ( evidence.stackContextStatus === 'conflicting' ) { return null; }
      // Direct and selected IDs may come from the same field. Only the
      // selector's three-state fresh parent validation can prove Container
      // ancestry, including a legitimately verified no-Stack target.
      result.stackKnown = evidence.stackContextStatus === 'verified' &&
        (evidence.stackId === null || identifier(evidence.stackId));
      if ( result.stackKnown && directStack && selectedStack !== directStack ) { return null; }
      result.stackId = result.stackKnown ? selectedStack : null;
      result.targetKnown = result.projectKnown && (expectedType !== 'container' || result.stackKnown);
    } else {
      result.stackId = selectedStack || directStack;
      result.stackKnown = !!result.stackId;
    }
    return result;
  }
  return null;
}

function selectedScopes(rules, evidenceByRule, labels) {
  let groups = [], byKey = new Map();
  rules.forEach((rule, index) => {
    let scope = rule && rule.scope || {};
    let key = validScope(scope) ? scopeKey(scope) : `invalid:${index}`;
    let group = byKey.get(key);
    if ( !group ) {
      group = {key: `scope:${key}`, kind: scope.kind || 'unknown', scope, rules: [], evidence: []};
      groups.push(group); byKey.set(key, group);
    }
    group.rules.push(rule);
    group.evidence.push(scope.kind === 'global' ? {label: text(labels.global), targetKnown: true} :
      validScope(scope) ? namedEvidence(scope, evidenceByRule && evidenceByRule[rule.id]) : null);
  });
  return groups.map((group) => {
    let proofs = group.evidence;
    let valid = validScope(group.scope) && proofs.every((proof) => proof && proof.targetKnown);
    let first = proofs.find(Boolean);
    if ( valid ) {
      valid = proofs.every((proof) => proof.label === first.label &&
        ['project', 'stack'].every((parent) => proof[`${parent}Known`] === first[`${parent}Known`] &&
          (!proof[`${parent}Known`] || proof[`${parent}Id`] === first[`${parent}Id`])));
    }
    let projectIds = [...new Set(proofs.filter(Boolean).map((proof) => proof.projectId).filter(Boolean))];
    let stackIds = [...new Set(proofs.filter(Boolean).map((proof) => proof.stackId).filter(Boolean))];
    valid = valid && projectIds.length <= 1 && stackIds.length <= 1;
    return Object.assign({}, group, {valid, label: valid ? first.label : text(labels.unverified),
      projectId: projectIds[0] || null, projectKnown: valid && proofs.every((proof) => proof.projectKnown),
      stackId: stackIds[0] || null, stackKnown: valid && proofs.every((proof) => proof.stackKnown)});
  });
}

// Relation of a rule's SET to a row's SET. Resource scopes are exact points;
// project/stack scopes also include their existing descendants and own object.
function relation(rule, row) {
  if ( row.kind === 'default' ) { return rule.kind === 'global' ? 'cover' : 'disjoint'; }
  if ( !rule.valid || !row.valid ) { return 'unknown'; }
  if ( rule.kind === 'global' ) { return 'cover'; }
  if ( row.kind === 'global' ) { return 'inside'; }
  if ( scopeKey(rule.scope) === scopeKey(row.scope) ) { return 'cover'; }
  if ( rule.kind === row.kind ) { return 'disjoint'; }
  let projectRelation = (child, parent, yes) => child.projectKnown ?
    child.projectId === parent.scope.resourceId ? yes : 'disjoint' : 'unknown';
  if ( rule.kind === 'project' ) { return projectRelation(row, rule, 'cover'); }
  if ( row.kind === 'project' ) { return projectRelation(rule, row, 'inside'); }
  let stackRelation = (child, parent, yes) => child.stackKnown ?
    child.stackId === parent.scope.resourceId ? yes : 'disjoint' :
    child.projectKnown && parent.projectKnown && child.projectId !== parent.projectId ? 'disjoint' : 'unknown';
  if ( rule.kind === 'stack' ) { return stackRelation(row, rule, 'cover'); }
  if ( row.kind === 'stack' ) { return stackRelation(rule, row, 'inside'); }
  return 'disjoint';
}

function genericDecision(row, operation, groups, defaultEffect) {
  let granted = defaultEffect === 'allow', explicitAllow = false, denied = false, unknown = false;
  groups.forEach((group) => group.rules.forEach((rule) => {
    if ( !rule.operations.includes(operation) ) { return; }
    let match = relation(group, row);
    if ( match === 'unknown' ) { unknown = true; }
    if ( match !== 'cover' ) { return; }
    if ( rule.effect === 'deny' ) { denied = true; }
    else { granted = true; explicitAllow = true; }
  }));
  if ( denied ) { return {state: 'deny', basis: 'explicitDeny'}; }
  if ( unknown ) { return {state: 'unknown', basis: 'unknownOverlap'}; }
  return {state: granted ? 'allow' : 'deny', basis: explicitAllow ? 'ruleAllow' : granted ? 'defaultAllow' : 'defaultDeny'};
}

function scopeCell(row, operation, groups, policy) {
  if ( !row.valid ) { return {state: 'unknown', basis: 'unknownEvidence'}; }
  let coveringDeny = groups.some((group) => relation(group, row) === 'cover' &&
    group.rules.some((rule) => rule.effect === 'deny' && rule.operations.includes(operation)));
  if ( coveringDeny ) { return {state: 'deny', basis: 'explicitDeny'}; }
  // Each selected nested SET and a symbolic remainder are kept separate. A
  // denial of one child must never become a denial of its whole parent scope.
  let pieces = [row].concat(groups.filter((group) => relation(group, row) === 'inside'));
  let results = pieces.map((piece) => genericDecision(piece, operation, groups, policy.defaultEffect));
  if ( results.some((result) => result.state === 'unknown') ) { return {state: 'unknown', basis: 'unknownOverlap'}; }
  if ( new Set(results.map((result) => result.state)).size > 1 ) { return {state: 'mixed', basis: 'scopeExceptions'}; }
  let result = results[0];
  if ( result.state === 'allow' && operation === 'create' ) { return {state: 'conditional', policyState: 'allow', basis: 'createDestination'}; }
  if ( result.state === 'allow' && MULTI_TARGET_WRITES.includes(operation) ) { return {state: 'conditional', policyState: 'allow', basis: 'multipleTargets'}; }
  return result;
}

/** Pure, finite policy-intent preview. Never an owner RBAC or API-call verdict.
 * Names and ancestry are accepted only from the matching fresh selector proof.
 * key is internal rendering identity; labels never fall back to IDs or type IDs.
 * Create destinations, references, dependency frames and live owner
 * access are still evaluated by the server; no resources are enumerated here.
 */
export function buildPolicyMatrix(policy, evidenceByRule = {}, labels = {}, now = Date.now()) {
  let expiry = expiryTimestamp(policy && policy.expiresAt);
  let valid = validPolicy(policy) && (expiry == null || Number.isFinite(expiry) && Number.isFinite(now));
  let expired = valid && expiry != null && now >= expiry;
  let rules = policy && policy.mode === 'custom' && Array.isArray(policy.rules) ? policy.rules : [];
  let groups = selectedScopes(rules, evidenceByRule, labels);
  let rows = [{key: 'default', kind: 'default', label: text(labels.default), valid: true}].concat(groups);
  return {kind: 'policy-intent', effectiveAccess: false,
    limits: ['liveOwnerRbac', 'expiry', 'createDestinations', 'multipleTargets'],
    operations: API_KEY_OPERATIONS.slice(),
    rows: rows.map((row) => ({key: row.key, kind: row.kind, label: row.label,
      cells: API_KEY_OPERATIONS.map((operation) => {
        let result = !valid ? {state: 'unknown', basis: 'invalidPolicy'} :
          expired ? {state: 'deny', basis: 'expired'} :
          policy.mode === 'full' ? {state: 'allow', basis: 'full'} :
            policy.mode === 'closed' ? {state: 'deny', basis: 'closed'} : scopeCell(row, operation, groups, policy);
        return Object.assign({operation, policyState: result.state}, result);
      })}))};
}
