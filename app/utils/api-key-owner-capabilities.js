import { API_KEY_OPERATIONS, canonicalResourceType } from 'ui/utils/api-key-policy';

// Aligned with Engine ApiKeyOperations: API operations, never role permissions.
export const API_KEY_ACTION_OPERATIONS = {
  upgrade: 'upgrade', finishupgrade: 'upgrade', cancelupgrade: 'upgrade', rollback: 'upgrade',
  activate: 'update', deactivate: 'update', start: 'update', stop: 'update', restart: 'update',
  rollingrestart: 'update', restore: 'update', update: 'update',
  remove: 'delete', purge: 'delete', delete: 'delete',
  execute: 'exec', exec: 'exec', logs: 'logs', log: 'logs',
  exportconfig: 'export', dockercomposeconfig: 'export', ranchercomposeconfig: 'export',
  composeconfig: 'export', config: 'export', pem: 'export', certificate: 'export',
  download: 'export', downloadconfig: 'export',
};
const STACK_TYPES = ['stack', 'service', 'container', 'volume'];
const PROJECT_TYPES = [...STACK_TYPES, 'project', 'host', 'network', 'secret', 'certificate',
  'registry', 'storagePool', 'storagePoolHostMap', 'networkPolicy', 'projectMember'];

export function scopeKey(scope) {
  return [scope && scope.kind, canonicalResourceType(scope && scope.resourceType) || '', scope && scope.resourceId || ''].join(':');
}
function typeKey(value) {
  let type = (canonicalResourceType(value) || '').toLowerCase();
  return ({instance: 'container', environment: 'stack', apikeyrestricted: 'apikey'})[type] || type;
}
function dictionary(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function namedOperations(value) {
  return Object.keys(value || {}).map((name) => API_KEY_ACTION_OPERATIONS[name.toLowerCase()]).filter(Boolean);
}
function schemaType(schema) { return typeKey(schema._id || schema.id); }

function schemaEvidence(schema, operation, object) {
  let methods = schema && schema.resourceMethods;
  let collection = schema && schema.collectionMethods;
  let declaredActions = schema && schema.resourceActions;
  let declaredLinks = schema && schema.resourceLinks;
  let actions = namedOperations(object ? object.actionLinks : declaredActions);
  let links = namedOperations(object ? object.links : Object.fromEntries((Array.isArray(declaredLinks) ? declaredLinks : []).map((name) => [name, true])));
  let method = operation === 'read' ? ['GET', 'HEAD'] : operation === 'update' ? ['PUT', 'PATCH'] : operation === 'delete' ? ['DELETE'] : [];
  if ( operation === 'create' ) {
    if ( !Array.isArray(collection) ) { return 'unknown'; }
    return collection.includes('POST') ? 'observed' : 'unavailable';
  }
  if ( method.length && !Array.isArray(methods) ) { return 'unknown'; }
  if ( (methods || []).some((value) => method.includes(value)) || actions.includes(operation) || links.includes(operation) ) { return 'observed'; }
  // Missing object actions can reflect state, not authority. Only an explicit
  // live schema without the corresponding action proves API unavailability.
  if ( !dictionary(declaredActions) || namedOperations(declaredActions).includes(operation) ) { return 'unknown'; }
  if ( ['exec', 'logs', 'export'].includes(operation) ) {
    if ( !Array.isArray(declaredLinks) ) { return 'unknown'; }
    if ( declaredLinks.some((name) => API_KEY_ACTION_OPERATIONS[String(name).toLowerCase()] === operation) ) { return 'unknown'; }
  }
  return 'unavailable';
}

export function ownerOperationStates(scope, evidence, ownerContextKnown) {
  let unknown = API_KEY_OPERATIONS.map((operation) => ({operation, status: 'unknown', unavailable: false}));
  if ( !ownerContextKnown || !scope || scope.kind === 'global' || !evidence ||
    evidence.scopeKey !== scopeKey(scope) || !evidence.contextVerified || !evidence.complete ) { return unknown; }
  let schemas = evidence.schemas || [];
  let selected = evidence.resource;
  let relevant;
  if ( scope.kind === 'resource' ) {
    relevant = schemas.filter((schema) => schemaType(schema) === typeKey(selected && selected.type || scope.resourceType));
    if ( relevant.length !== 1 || !selected || selected.id !== scope.resourceId || typeKey(selected.type) !== typeKey(scope.resourceType) ) { return unknown; }
  } else {
    if ( evidence.projectId !== (scope.kind === 'project' ? scope.resourceId : selected && selected.accountId) ) { return unknown; }
    let required = scope.kind === 'stack' ? STACK_TYPES : PROJECT_TYPES;
    let present = new Set(schemas.map(schemaType));
    // Do not infer a scope-wide denial from one type or incomplete metadata.
    if ( required.some((type) => !present.has(typeKey(type))) ) { return unknown; }
    relevant = schemas.filter((schema) => required.map(typeKey).includes(schemaType(schema)) ||
      required.map(typeKey).includes(typeKey(schema.baseType)));
  }
  return API_KEY_OPERATIONS.map((operation) => {
    // Engine creation checks destination parents, not this object's POST alone.
    let status = scope.kind === 'resource' && operation === 'create' ? 'unknown' : null;
    if ( !status ) {
      let states = relevant.map((schema) => schemaEvidence(schema, operation, scope.kind === 'resource' ? selected : null));
      status = states.includes('observed') ? 'observed' : states.length && states.every((item) => item === 'unavailable') ? 'unavailable' : 'unknown';
    }
    return {operation, status, unavailable: status === 'unavailable'};
  });
}
