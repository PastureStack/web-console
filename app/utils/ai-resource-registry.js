// Closed resource descriptors shared by the browser and stdio bridge. A tool
// never supplies a URL, HTTP method, raw resource ID or projection expression.
const common = ['name', 'description', 'state', 'created', 'removed'];
const bridgeReads = ['project', 'stack', 'service'];
const nativeReads = ['project', 'stack', 'service', 'container', 'host', 'network', 'volume', 'storagePool', 'backupTarget', 'snapshot', 'virtualMachine'];
const viewReads = ['project', 'account', 'stack', 'service', 'loadBalancerService', 'dnsService', 'externalService', 'container', 'virtualMachine', 'host',
  'volume', 'snapshot', 'backup', 'backupTarget', 'storagePool', 'storageDriver', 'network', 'networkDriver', 'certificate', 'registry', 'registryCredential',
  'apiKey', 'apiKeyRestricted', 'setting', 'activeSetting', 'machineDriver', 'secret', 'processInstance', 'processExecution', 'projectTemplate', 'processPool', 'auditLog'];
const resource = (type, collection, scope, fields = [], parent = null, limitations = []) => Object.freeze({
  type, collection, scope, readTransport: ['service', 'loadBalancerService', 'dnsService', 'externalService'].includes(type) ? 'view' : nativeReads.includes(type) ? 'domain' : viewReads.includes(type) ? 'view' : 'pending',
  bridgeRead: bridgeReads.includes(type), fields: Object.freeze([...common, ...fields]), parent: parent && Object.freeze(parent), limitations: Object.freeze(limitations),
});
const project = (type, collection, fields, parent) => resource(type, collection, 'project', fields, parent);
const global = (type, collection, fields, limitations) => resource(type, collection, 'global', fields, null, limitations);
// Catalog is selected-project visibility over global and project templates.
// Its typed gateway owns authorization and never returns raw template files.
const catalog = (type, fields, parent = null) => Object.freeze({
  type, collection: null, scope: 'project', readTransport: 'catalog', bridgeRead: false,
  fields: Object.freeze(fields), parent: parent && Object.freeze(parent), limitations: Object.freeze([]),
});
const family = (name, resources, coverageStatus = 'implemented', reason = '') => Object.freeze({
  name, coverageStatus, reason, resources: Object.freeze(resources),
});

export const RESOURCE_FAMILIES = Object.freeze([
  family('accounts', [global('account', 'accounts', ['kind'])]),
  family('api-keys', [global('apiKey', 'apikeys', ['kind', 'expiresAt']),
    global('apiKeyRestricted', 'apikeyrestricteds', ['kind', 'expiresAt'])], 'pending-adapter',
  'Safe metadata reads support legacy apiKey and restricted or expiring apiKeyRestricted. Detail can return a configured-policy snapshot and partial native owner-ceiling facts, never effective Key authorization. Unavailable scope previews remain explicit and cannot be applied as a permission matrix. Select resourceType explicitly for the intended kind, including same-name Keys. Omitting resourceType queries apiKey only and does not combine both kinds. Credential creation, policy changes and revocation remain in the normal human Key UI; this is partial workflow coverage.'),
  family('audit', [global('auditLog', 'auditLogs', ['eventType', 'resourceType', 'responseCode', 'httpStatus', 'authType', 'interactionChannel', 'decision', 'outcome', 'operation'])], 'pending-adapter', 'Typed audit metadata queries are implemented through the matching Engine and broker owner for the native session and dedicated-Key bridge. Export and raw request/response payloads remain in the human audit UI; this is partial workflow coverage.'),
  family('authentication', [], 'pending-adapter', 'Authentication configuration uses its dedicated authenticated API. Login and credential entry remain human ceremonies.'),
  family('catalog', [catalog('catalogTemplate', ['name', 'description', 'catalogId', 'templateBase', 'templateKey', 'catalogScope', 'defaultVersion', 'maintainer', 'license']),
    catalog('catalogTemplateVersion', ['version', 'revision', 'minimumRancherVersion', 'maximumRancherVersion', 'upgradeFrom'], {type: 'catalogTemplate', field: 'templateId', required: true})],
  'pending-adapter', 'Template and version metadata use the dedicated authorized Catalog adapter. Configured defaultVersion and version bounds do not establish compatibility. Typed stack launch needs target-scope read, create and update permissions and a dedicated human-approved plan. External volume references (external=true), Catalog administration and upgrades still need adapters.'),
  family('certificates', [resource('certificate', 'certificates', 'project', ['CN', 'issuer', 'issuedAt', 'expiresAt', 'algorithm', 'keySize'], null,
    ['Typed changes support name/description only. PEM, private keys, certificate chains, issuance, renewal and removal remain in the normal human certificate UI.'])]),
  family('container', [project('container', 'containers', ['healthState', 'memory', 'cpuShares', 'startCount'])]),
  family('environment', [global('project', 'projects', ['orchestration', 'virtualMachine'], ['Typed changes support name/description only for the currently selected environment. Other visible environments remain queryable; use the normal environment switch and search again for a fresh reference before editing. Membership, authentication, networking, orchestration and lifecycle changes remain in their normal human workflows.']), global('projectTemplate', 'projectTemplates')]),
  family('global', [], 'pending-adapter', 'Shared navigation and UI controls need semantic UI helpers, not a synthetic resource endpoint.'),
  family('host', [resource('host', 'hosts', 'project', ['hostname', 'agentState', 'memory', 'milliCpu', 'localStorageMb'], null,
    ['Host detail may include at most 50 freshly authorized container references with readable Stack names. Workload completeness stays unknown, including when empty; it does not establish an empty Host or authorize evacuation, deactivation or scheduling. Typed changes support nonempty custom name and description only. Clearing the custom name, labels, capacity/scheduling, hostname, agent lifecycle and credentials remain in the normal human host UI.']), global('machineDriver', 'machineDrivers', ['active', 'builtin'])]),
  family('load-balancer', [resource('loadBalancerService', 'loadBalancerServices', 'project', ['scale', 'healthState', 'archived'], {type: 'stack', field: 'stackId'}, ['Typed create is the ordered TCP service-reference subset only, with explicit startOnCreate, scale 1 and the current server-managed image. HTTPS/TLS/HTTP, certificates, selectors, custom configuration, scheduling, and existing LB port/configuration edits remain outside it. Shared Service start/stop accept empty parameters, fresh targetRef and a separate human approval. Non-Global manual scale accepts only an integer scale of at least 1, preserves active/inactive state and never starts an inactive load balancer. Restart/remove/upgrade are not offered. Metadata updates still support name/description only.'])]),
  family('mfa-passkey', [], 'human-ceremony', 'MFA enrollment, challenges, recovery codes and passkeys require the existing human security flow.'),
  family('network', [project('network', 'networks', ['kind', 'defaultPolicyAction'])]),
  family('oidc', [], 'pending-adapter', 'OIDC configuration metadata requires the dedicated authentication API adapter. Login is a human ceremony.'),
  family('orchestration', [project('kubernetesStack', 'kubernetesStacks', ['namespace'])], 'pending-adapter', 'Orchestration APIs require a dedicated adapter.'),
  family('processes', [global('processExecution', 'processExecutions', [], ['Only basic id/created metadata; named process summaries and errors need a dedicated adapter. Raw logs are excluded.']), global('processPool', 'processPools', ['activeTasks', 'poolSize', 'queueSize']), Object.freeze({...global('processInstance', 'processInstances'), fields: Object.freeze(['name', 'processName', 'phase', 'exitReason', 'startTime', 'endTime', 'runAfter', 'created', 'executionCount', 'diagnosticStatus', 'diagnosticCompleteness', 'diagnosticTruncated', 'diagnosticTruncationReason', 'hasException', 'failedHandler'])})],
    'pending-adapter', 'ProcessInstance list and detail use current native global process read permission, never Project ownership. Only registered process/handler names, fixed phase/exitReason, times and bounded diagnostics are returned. Diagnostic completeness remains unknown; no exception text, stack traces, payloads or replay is exposed. Custom Key scopes unsupported by the native owner remain denied. Existing processExecution and processPool metadata remain separate partial subsets.'),
  family('registry', [resource('registry', 'registries', 'project', ['serverAddress', 'addressStatus'], null,
    ['Start/stop only, with empty parameters and a separately human-approved plan. Identify the exact registry by its safe serverAddress; unknown addresses cannot be used for lifecycle preview. Credential creation/editing, registry removal and arbitrary storage-pool changes remain in the normal human UI.'])]),
  family('secrets', [project('secret', 'secrets')]),
  family('service', [project('service', 'services', ['scale', 'healthState', 'archived'], {type: 'stack', field: 'stackId'}),
    resource('dnsService', 'dnsServices', 'project', ['scale', 'healthState', 'archived', 'targetServices', 'linkedServiceCount', 'unresolvedTargetCount'], {type: 'stack', field: 'stackId'}, ['Two-step Alias workflow: create makes an empty stopped Alias with no targets; update_targets needs selected same-session serviceRefs and another human-approved plan. Start is optional and separate. Named/ported/remote links and incoming-consumer cleanup remain pending.']), resource('externalService', 'externalServices', 'project', ['scale', 'healthState', 'archived', 'hostname', 'externalIpAddresses'], {type: 'stack', field: 'stackId'}, ['Typed changes cover name/description, safe DNS/IP targets and optional load-balancer-backend-only TCP health checks during creation only, not standalone monitoring. HTTP health checks, health-check updates, cloning and advanced settings remain pending. Create is inactive until a separately approved start.'])]),
  family('settings', [global('setting', 'settings', ['source', 'inDb'])]),
  family('stack', [project('stack', 'stacks', ['system', 'archived', 'group'])]),
  family('storage', [resource('volume', 'volumes', 'project', ['isHostPath', 'isNative', 'driver', 'accessMode', 'size', 'sizeMb'], null, ['Create supports only an unallocated builtin local logical Volume record, with name/description. Host allocation, mounts, driver options and plugin drivers remain separate human workflows; this is partial workflow coverage.', 'Detail-only usage references are bounded to 50 freshly authorized containers. Completeness is unknown, even when empty; never infer unused or safe deletion.']),
    project('storagePool', 'storagePools'), project('backupTarget', 'backupTargets'), project('snapshot', 'snapshots'), project('backup', 'backups')]),
  family('terminal-logs', [], 'pending-adapter', 'Bounded log reads need a dedicated redaction and stream adapter; interactive terminals require the human UI.'),
  family('virtualmachine', [project('virtualMachine', 'virtualMachines', ['vcpu', 'memoryMb'])]),
  family('webhooks', [], 'pending-adapter', 'Webhook metadata requires the dedicated webhook API adapter; receiver tokens are never tool output.'),
]);

export const RESOURCE_TYPES = Object.freeze([...new Set(RESOURCE_FAMILIES.flatMap((entry) => entry.resources.map((item) => item.type)))]);
export function resourceFamily(name) { return RESOURCE_FAMILIES.find((entry) => entry.name === name); }

const policyOperations = ['read', 'create', 'update', 'upgrade', 'delete', 'exec', 'logs', 'export'];
const policyMessages = {
  POLICY_FIELDS_UNAVAILABLE: 'The native role does not expose the configured policy and revision.',
  POLICY_NOT_CANONICAL: 'The native configured policy cannot be represented by this closed read projection.',
  SCOPE_TARGET_UNAVAILABLE: 'This configured scope has no freshly authorized readable target preview.',
  SCOPE_CONTEXT_UNAVAILABLE: 'This scope cannot be referenced in the current selected environment.',
  SCOPE_PREVIEW_INCOMPLETE: 'All configured rules are included, but some scope targets cannot be fully previewed.',
  KEY_OWNER_CONTEXT_UNAVAILABLE: 'The current actor is not proven to be this Key owner.',
  SCOPE_CAPABILITY_METADATA_UNAVAILABLE: 'Complete native owner-ceiling metadata is unavailable for this scope.',
  OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION: 'Owner-ceiling facts are not this Key effective authorization or an approval to apply a change.',
};
const policyDictionary = value => !!value && typeof value === 'object' && !Array.isArray(value);
const policyText = value => typeof value === 'string' && value.length <= 512 && !/[\x00-\x1f\x7f]/.test(value);
function policyRequire(value) { if ( !value ) { throw new TypeError('Invalid configured-policy read projection'); } }
function policyKeys(value, keys) { policyRequire(policyDictionary(value) && Object.keys(value).every(key => keys.includes(key))); }
function policyCapabilities(raw) {
  policyKeys(raw, ['basis', 'effectiveAuthorization', 'operations', 'reason']);
  policyRequire(raw.basis === 'native-owner-ceiling' && raw.effectiveAuthorization === 'not-evaluated' &&
    ['KEY_OWNER_CONTEXT_UNAVAILABLE', 'SCOPE_CAPABILITY_METADATA_UNAVAILABLE', 'OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION'].includes(raw.reason) &&
    Array.isArray(raw.operations) && raw.operations.length === policyOperations.length);
  const seen = new Set();
  const operations = raw.operations.map(item => {
    policyKeys(item, ['operation', 'status']);
    policyRequire(policyOperations.includes(item.operation) && !seen.has(item.operation) && ['observed', 'unavailable', 'unknown'].includes(item.status));
    seen.add(item.operation);
    return {operation: item.operation, status: item.status};
  });
  return {basis: 'native-owner-ceiling', effectiveAuthorization: 'not-evaluated', operations,
    reason: raw.reason, message: policyMessages[raw.reason]};
}
function unavailablePolicyCapabilities() {
  return policyCapabilities({basis: 'native-owner-ceiling', effectiveAuthorization: 'not-evaluated',
    reason: 'SCOPE_CAPABILITY_METADATA_UNAVAILABLE', operations: policyOperations.map(operation => ({operation, status: 'unknown'}))});
}

// This is detail-only. No native scope ID or arbitrary nested field reaches a model.
export function configuredPolicyRead(raw, referenceTarget) {
  policyKeys(raw, ['availability', 'representation', 'previewComplete', 'reason', 'effectiveAuthorization',
    'revision', 'configuredPolicy', 'defaultOwnerCapabilities', 'allConfiguredRulesIncluded', 'scopePreviewComplete']);
  policyRequire(raw.representation === 'configured-policy-read-only' && raw.previewComplete === false && raw.effectiveAuthorization === 'not-evaluated');
  if ( raw.availability === 'unavailable' ) {
    policyRequire(['POLICY_FIELDS_UNAVAILABLE', 'POLICY_NOT_CANONICAL'].includes(raw.reason) &&
      Object.keys(raw).every(key => ['availability', 'representation', 'previewComplete', 'reason', 'effectiveAuthorization'].includes(key)));
    return {availability: 'unavailable', representation: raw.representation, previewComplete: false,
      effectiveAuthorization: 'not-evaluated', reason: raw.reason, message: policyMessages[raw.reason]};
  }
  policyRequire(raw.availability === 'available' && Number.isSafeInteger(raw.revision) && raw.revision >= 0 &&
    raw.allConfiguredRulesIncluded === true && typeof raw.scopePreviewComplete === 'boolean' &&
    ['SCOPE_PREVIEW_INCOMPLETE', 'OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION'].includes(raw.reason));
  const policy = raw.configuredPolicy;
  policyKeys(policy, ['mode', 'defaultEffect', 'purpose', 'expiresAt', 'rules']);
  policyRequire(['full', 'closed', 'custom'].includes(policy.mode) && ['allow', 'deny'].includes(policy.defaultEffect) &&
    ['general', 'ai-bridge'].includes(policy.purpose) && (policy.expiresAt === null ||
      typeof policy.expiresAt === 'string' && policy.expiresAt.length <= 64 && /^[+-]?\d{4,10}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(policy.expiresAt)) &&
    Array.isArray(policy.rules) && policy.rules.length <= 128 &&
    (policy.mode === 'custom' || policy.rules.length === 0 && policy.defaultEffect === (policy.mode === 'full' ? 'allow' : 'deny')));
  let sourceComplete = true, currentComplete = true;
  const rules = policy.rules.map((rule, index) => {
    policyKeys(rule, ['ordinal', 'effect', 'operations', 'scope', 'ownerCapabilities']);
    policyRequire(rule.ordinal === index+1 && ['allow', 'deny'].includes(rule.effect) && Array.isArray(rule.operations) &&
      rule.operations.length > 0 && rule.operations.length <= policyOperations.length &&
      new Set(rule.operations).size === rule.operations.length && rule.operations.every(operation => policyOperations.includes(operation)));
    const ownerCapabilities = policyCapabilities(rule.ownerCapabilities);
    const scope = rule.scope;
    policyKeys(scope, ['kind', 'resourceType', 'availability', 'reason', 'target']);
    policyRequire(['global', 'project', 'stack', 'resource'].includes(scope.kind) && ['resolved', 'unavailable'].includes(scope.availability) &&
      (scope.resourceType === undefined || RESOURCE_TYPES.includes(scope.resourceType)) &&
      (scope.kind !== 'project' || scope.resourceType === 'project' || scope.availability === 'unavailable') &&
      (scope.kind !== 'stack' || scope.resourceType === 'stack' || scope.availability === 'unavailable') &&
      scope.reason === (scope.availability === 'resolved' ? 'NONE' : 'SCOPE_TARGET_UNAVAILABLE'));
    let target = null;
    if ( scope.kind === 'global' ) {
      policyRequire(scope.resourceType === undefined && scope.target === undefined && scope.availability === 'resolved');
    } else if ( scope.availability === 'resolved' ) {
      policyKeys(scope.target, ['id', 'type', 'name', 'accountId', 'stackId', 'stackName', 'parentResolution']);
      policyRequire(scope.resourceType && scope.target.type === scope.resourceType && policyText(scope.target.id) &&
        /^[a-zA-Z0-9_.:-]{1,256}$/.test(scope.target.id) && !['.', '..'].includes(scope.target.id) &&
        Object.values(scope.target).every(policyText));
      target = referenceTarget(scope.target);
      if ( !target ) { currentComplete = false; }
    } else {
      policyRequire(scope.target === undefined); sourceComplete = false; currentComplete = false;
    }
    const projectedScope = {kind: scope.kind, availability: scope.kind === 'global' || target ? 'resolved' : 'unavailable'};
    if ( scope.resourceType ) { projectedScope.resourceType = scope.resourceType; }
    if ( target ) { projectedScope.target = target; }
    if ( projectedScope.availability === 'unavailable' ) {
      projectedScope.reason = scope.availability === 'resolved' ? 'SCOPE_CONTEXT_UNAVAILABLE' : 'SCOPE_TARGET_UNAVAILABLE';
      projectedScope.message = policyMessages[projectedScope.reason];
    }
    return {ordinal: rule.ordinal, effect: rule.effect, operations: rule.operations.slice(), scope: projectedScope,
      ownerCapabilities: scope.kind !== 'global' && !target ? unavailablePolicyCapabilities() : ownerCapabilities};
  });
  policyRequire(sourceComplete === raw.scopePreviewComplete);
  const reason = sourceComplete && currentComplete ? 'OWNER_CEILING_IS_NOT_EFFECTIVE_AUTHORIZATION' : 'SCOPE_PREVIEW_INCOMPLETE';
  return {availability: 'available', representation: 'configured-policy-read-only', revision: raw.revision,
    configuredPolicy: {mode: policy.mode, defaultEffect: policy.defaultEffect, purpose: policy.purpose, expiresAt: policy.expiresAt, rules},
    defaultOwnerCapabilities: policyCapabilities(raw.defaultOwnerCapabilities), allConfiguredRulesIncluded: true,
    scopePreviewComplete: sourceComplete && currentComplete, effectiveAuthorization: 'not-evaluated', previewComplete: false,
    reason, message: policyMessages[reason]};
}
export function resourceDescriptor(familyName, type) {
  const entry = resourceFamily(familyName);
  return entry && entry.resources.find((item) => item.type === (type || entry.resources[0] && entry.resources[0].type));
}
export function resourceDescriptors() { return RESOURCE_FAMILIES.flatMap((entry) => entry.resources); }

const action = (fields = [], required = [], minFields = 0) => Object.freeze({fields: Object.freeze(fields), required: Object.freeze(required), minFields});
const metadata = action(['name', 'description'], [], 1);
// Closed human-review projection; native authorization and generation CAS remain server-owned.
export const SERVICE_UPGRADE_LIFECYCLE = Object.freeze({
  finish_upgrade: Object.freeze({before: Object.freeze(['upgraded']), after: 'active'}),
  rollback: Object.freeze({before: Object.freeze(['upgrading', 'upgraded', 'canceled-upgrade']), after: 'active'}),
  cancel_upgrade: Object.freeze({before: Object.freeze(['upgrading', 'finishing-upgrade']), after: 'canceled-upgrade'}),
});
export const RESOURCE_CHANGES = Object.freeze({
  volume: Object.freeze({create: action(['name', 'description'], ['name'])}),
  registry: Object.freeze({start: action(), stop: action()}),
  project: Object.freeze({update_metadata: metadata}),
  loadBalancerService: Object.freeze({start: action(), stop: action(), scale: action(['scale'], ['scale']), update_metadata: metadata, create: action(['name', 'description', 'startOnCreate', 'portRules'], ['name', 'startOnCreate', 'portRules'])}),
  certificate: Object.freeze({update_metadata: metadata}),
  host: Object.freeze({update_metadata: metadata}),
  stack: Object.freeze({start: action(), stop: action(), remove: action(), archive: action(), restore: action(), create: action(['name', 'description'], ['name']),
    create_from_catalog: action(['name', 'description', 'startOnCreate', 'answers'], ['name']), update_metadata: action(['name', 'description', 'group'], [], 1)}),
  service: Object.freeze({start: action(), stop: action(), restart: action(), remove: action(), archive: action(), restore: action(),
    finish_upgrade: action(), rollback: action(), cancel_upgrade: action(), scale: action(['scale'], ['scale']),
    update_links: action(['serviceRefs'], ['serviceRefs']),
    create: action(['name', 'image', 'scale', 'description', 'command', 'entryPoint', 'ports', 'healthCheck'], ['name', 'image']), update_metadata: metadata}),
  dnsService: Object.freeze({start: action(), stop: action(), remove: action(), update_metadata: metadata,
    create: action(['name', 'description'], ['name']), update_targets: action(['serviceRefs'], ['serviceRefs'])}),
  externalService: Object.freeze({start: action(), stop: action(), remove: action(), update_metadata: metadata,
    create: action(['name', 'description', 'hostname', 'externalIpAddresses', 'healthCheck'], ['name']),
    update_targets: action(['hostname', 'externalIpAddresses'], [], 1)}),
  container: Object.freeze({start: action(), stop: action(), restart: action(), remove: action(),
    create: action(['name', 'image', 'description', 'command', 'entryPoint', 'ports'], ['name', 'image']), update_metadata: metadata}),
});
export const CHANGE_OPERATIONS = Object.freeze([...new Set(Object.values(RESOURCE_CHANGES).flatMap((entry) => Object.keys(entry)))]);
export const RESOURCE_CHANGE_FIELDS = Object.freeze(['name', 'description', 'group', 'hostname', 'externalIpAddresses', 'targetServices', 'image', 'scale', 'command', 'entryPoint', 'ports', 'healthCheck', 'stackId', 'archived',
  'portRules', 'driver', 'state', 'operation', 'childServiceState', 'startOnCreate', 'affectedServiceCount', 'emptyStack', 'affectedInstanceCount', 'affectedMountCount', 'mountedDataRule']);

// Only scalar allowlisted values cross the boundary. Nested structures can
// contain credentials (including audit payloads, stack YAML and key policies).
export function safeResourceFields(body, descriptor) {
  if ( descriptor.type === 'processInstance' ) { return safeProcessFields(body); }
  const result = {};
  for ( const field of descriptor.fields ) {
    if ( descriptor.type === 'registry' && ['serverAddress', 'addressStatus'].includes(field) ) { continue; }
    const value = body[field];
    if ( typeof value === 'string' ) { result[field] = value.slice(0, field === 'targetServices' ? 100000 : ['description', 'externalIpAddresses'].includes(field) ? 1024 : 512); }
    else if ( typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || value === null ) { result[field] = value; }
  }
  if ( descriptor.type === 'registry' ) {
    result.serverAddress = safeRegistryAddress(body.serverAddress);
    result.addressStatus = result.serverAddress === null ? 'unknown' : 'known';
  }
  return result;
}

export function safeRegistryAddress(value) {
  if ( typeof value !== 'string' || !value || value.length > 260 || !/^[A-Za-z0-9.\[\]:-]+$/.test(value) || value.endsWith(':') ) { return null; }
  try {
    const endpoint = new URL(`https://${value}`);
    return endpoint.hostname && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/' &&
      (!endpoint.port || Number(endpoint.port) >= 1 && Number(endpoint.port) <= 65535) ? value : null;
  } catch (invalid) { return null; }
}
export function truncatedResourceFields(body, descriptor) {
  return descriptor.fields.filter((field) => typeof body[field] === 'string' && body[field].length > (field === 'targetServices' ? 100000 : ['description', 'externalIpAddresses'].includes(field) ? 1024 : 512));
}

// Server registry attestation owns these names; no untrusted resource labels or log text are substituted.
const PROCESS_PHASES = new Set(['REQUESTED', 'STARTED', 'PRE_LISTENERS', 'PRE_LISTENERS_DONE', 'HANDLERS', 'HANDLER_DONE', 'POST_LISTENERS', 'POST_LISTENERS_DONE', 'DONE']);
const PROCESS_EXITS = new Set(['ALREADY_DONE', 'CANCELED', 'AUTHORIZATION_DENIED', 'AUDIT_PENDING', 'DELAY', 'STATE_CHANGED', 'DONE', 'DELEGATE', 'SCHEDULED', 'PROCESS_ALREADY_IN_PROGRESS', 'RESOURCE_BUSY', 'RETRY_EXCEPTION', 'UNKNOWN_EXCEPTION', 'TIMEOUT', 'CHAIN']);
function safeProcessFields(body) {
  const result = {};
  if ( body.name === 'unknown' ) { result.name = 'unknown'; }
  if ( typeof body.processName === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(body.processName) && body.name === body.processName ) {
    result.name = body.processName; result.processName = body.processName;
  }
  if ( PROCESS_PHASES.has(body.phase) ) { result.phase = body.phase; }
  if ( PROCESS_EXITS.has(body.exitReason) ) { result.exitReason = body.exitReason; }
  for ( const field of ['startTime', 'endTime', 'runAfter', 'created'] ) {
    if ( body[field] === null ) { result[field] = null; }
    else if ( typeof body[field] === 'string' && body[field].length <= 32 && /^\d{4}-\d\d-\d\dT/.test(body[field]) && Number.isFinite(Date.parse(body[field])) ) { result[field] = body[field]; }
  }
  if ( Number.isSafeInteger(body.executionCount) && body.executionCount >= 0 ) { result.executionCount = body.executionCount; }
  if ( ['available', 'unknown'].includes(body.diagnosticStatus) ) { result.diagnosticStatus = body.diagnosticStatus; }
  if ( body.diagnosticCompleteness === 'unknown' ) { result.diagnosticCompleteness = 'unknown'; }
  if ( typeof body.hasException === 'boolean' ) { result.hasException = body.hasException; }
  if ( typeof body.failedHandler === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(body.failedHandler) ) { result.failedHandler = body.failedHandler; }
  if ( body.diagnosticTruncated === true ) {
    result.diagnosticStatus = 'unknown'; result.diagnosticCompleteness = 'unknown';
    result.diagnosticTruncated = true;
    if ( ['source_limit', 'entry_budget', 'utf8_budget'].includes(body.diagnosticTruncationReason) ) { result.diagnosticTruncationReason = body.diagnosticTruncationReason; }
    delete result.hasException; delete result.failedHandler;
  }
  return result;
}
