import { canonicalResourceType } from 'ui/utils/api-key-policy';

export const PLATFORM_SCOPE_TYPES = ['project', 'setting', 'userpreference', 'apikey', 'apikeyrestricted', 'account', 'auditlog'];
export const readField = (item, name) => item && (typeof item.get === 'function' ? item.get(name) : item[name]);
export const scopeType = (scope) => scope && (scope.kind === 'resource' ? scope.resourceType : scope.kind);
export const typeKey = (type) => (canonicalResourceType(type) || '').toLowerCase();
export const isPlatformScope = (type) => PLATFORM_SCOPE_TYPES.includes(String(type || '').toLowerCase());
export const hasStackParent = (type) => ['service', 'container'].includes(typeKey(type));
export const collectionItems = (items) => typeof items?.toArray === 'function' ? items.toArray() : Array.from(items || []);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
export function sameReadableNameFields(detail, candidate) {
  return text(readField(detail, 'name')) === text(readField(candidate, 'name')) &&
    text(readField(detail, 'description')) === text(readField(candidate, 'description'));
}
export function namedOptions(items, {prefix = '', typeLabel = ''} = {}) {
  let missingNames = 0;
  let options = collectionItems(items).filter((item) => !readField(item, 'removed') && !['removed', 'purged'].includes(readField(item, 'state'))).flatMap((item) => {
    let id = readField(item, 'id'), name = text(readField(item, 'name'));
    // Legacy displayName can silently fall back to an ID: never use it here.
    if ( !id || !name || name === id ) { missingNames++; return []; }
    let description = text(readField(item, 'description'));
    let label = [prefix, name].filter(Boolean).join(' / ');
    if ( typeLabel ) { label += ` · ${typeLabel}`; }
    if ( description ) { label += ` — ${description}`; }
    return [{id, name, label, searchText: label, resource: item}];
  });
  let counts = new Map();
  options.forEach((option) => counts.set(option.label.toLocaleLowerCase(), (counts.get(option.label.toLocaleLowerCase()) || 0) + 1));
  let ambiguous = options.filter((option) => counts.get(option.label.toLocaleLowerCase()) > 1);
  return {options: options.filter((option) => !ambiguous.includes(option)), missingNames, ambiguous: ambiguous.length};
}
export function projectResources(items, projectId) {
  return collectionItems(items).filter((item) => readField(item, 'accountId') === projectId);
}
export function stackParentEvidence(item, services = []) {
  let explicit = readField(item, 'stackId') || null;
  let ids = readField(item, 'serviceIds');
  if ( ids != null && !Array.isArray(ids) ) { return {stackId: null, status: 'unknown'}; }
  let native = readField(item, 'serviceId');
  let serviceIds = [...new Set([native, ...(ids || [])].filter(Boolean))];
  let expected = explicit, hasExpected = explicit !== null;
  for ( let id of serviceIds ) {
    let service = services.find((value) => readField(value, 'id') === id);
    if ( !service || readField(service, 'removed') || ['removed', 'purged'].includes(readField(service, 'state')) ) {
      return {stackId: null, status: 'unknown'};
    }
    let projectId = readField(item, 'accountId'), serviceProject = readField(service, 'accountId');
    if ( projectId && serviceProject && projectId !== serviceProject ) { return {stackId: null, status: 'conflicting'}; }
    let parent = readField(service, 'stackId') || null;
    // Null is an actual no-Stack relation, not a wildcard. A direct Stack and
    // service-derived Stack must agree; missing service evidence is unknown.
    if ( hasExpected && expected !== parent ) { return {stackId: null, status: 'conflicting'}; }
    expected = parent; hasExpected = true;
  }
  return {stackId: expected, status: 'verified'};
}
export function stackParent(item, services = []) {
  let evidence = stackParentEvidence(item, services);
  return evidence.status === 'verified' ? evidence.stackId : null;
}
export function resourcesInStack(items, parentId, services = []) {
  return collectionItems(items).filter((item) => stackParent(item, services) === parentId);
}
export function schemaForType(schemas, type) {
  let exact = schemas.filter((schema) => String(readField(schema, 'id') || readField(schema, '_id')).toLowerCase() === String(type).toLowerCase());
  let matching = exact.length ? exact : schemas.filter((schema) => typeKey(readField(schema, 'id') || readField(schema, '_id')) === typeKey(type));
  return matching.length === 1 ? matching[0] : null;
}
export function collectionLink(schemas, type) {
  let schema = schemaForType(schemas, type), methods = readField(schema, 'collectionMethods'), links = readField(schema, 'links');
  return Array.isArray(methods) && methods.includes('GET') && typeof links?.collection === 'string' ? links.collection : null;
}
export function selectionMatches(scope, evidence) {
  return scope.kind === 'global' || !!scope.resourceId && evidence?.selectionValid === true &&
    evidence.contextVerified === true && evidence.complete === true &&
    evidence.scopeKey === [scope.kind, canonicalResourceType(scope.resourceType) || '', scope.resourceId].join(':') &&
    typeof evidence.selectionLabel === 'string' && !!evidence.selectionLabel.trim();
}
