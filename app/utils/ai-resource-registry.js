// Closed resource descriptors shared by the browser and stdio bridge. A tool
// never supplies a URL, HTTP method, raw resource ID or projection expression.
const common = ['name', 'description', 'state', 'created', 'removed'];
const bridgeReads = ['project', 'stack', 'service'];
const nativeReads = ['project', 'stack', 'service', 'container', 'host', 'network', 'volume', 'storagePool', 'backupTarget', 'snapshot', 'virtualMachine'];
const viewReads = ['project', 'account', 'stack', 'service', 'loadBalancerService', 'dnsService', 'externalService', 'container', 'virtualMachine', 'host',
  'volume', 'snapshot', 'backup', 'backupTarget', 'storagePool', 'storageDriver', 'network', 'networkDriver', 'certificate', 'registry', 'registryCredential',
  'apiKey', 'apiKeyRestricted', 'setting', 'activeSetting', 'machineDriver', 'secret', 'processExecution', 'projectTemplate', 'processPool', 'auditLog'];
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
  family('api-keys', [global('apiKey', 'apikeys', ['kind', 'expiresAt'])]),
  family('audit', [global('auditLog', 'auditLogs', ['eventType', 'resourceType', 'responseCode', 'httpStatus', 'authType', 'interactionChannel', 'decision', 'outcome', 'operation'])], 'pending-adapter', 'Typed audit metadata queries are implemented through the matching Engine and broker owner for the native session and dedicated-Key bridge. Export and raw request/response payloads remain in the human audit UI; this is partial workflow coverage.'),
  family('authentication', [], 'pending-adapter', 'Authentication configuration uses its dedicated authenticated API. Login and credential entry remain human ceremonies.'),
  family('catalog', [catalog('catalogTemplate', ['name', 'description', 'catalogId', 'templateBase', 'templateKey', 'catalogScope', 'defaultVersion', 'maintainer', 'license']),
    catalog('catalogTemplateVersion', ['version', 'revision', 'minimumRancherVersion', 'maximumRancherVersion', 'upgradeFrom'], {type: 'catalogTemplate', field: 'templateId', required: true})],
  'pending-adapter', 'Template and version metadata use the dedicated authorized Catalog adapter. Configured defaultVersion and version bounds do not establish compatibility. Typed stack launch needs target-scope read, create and update permissions and a dedicated human-approved plan. External volume references (external=true), Catalog administration and upgrades still need adapters.'),
  family('certificates', [resource('certificate', 'certificates', 'project', ['CN', 'issuer', 'issuedAt', 'expiresAt', 'algorithm', 'keySize'], null,
    ['Typed changes support name/description only. PEM, private keys, certificate chains, issuance, renewal and removal remain in the normal human certificate UI.'])]),
  family('container', [project('container', 'containers', ['healthState', 'memory', 'cpuShares', 'startCount'])]),
  family('environment', [global('project', 'projects', ['orchestration', 'virtualMachine']), global('projectTemplate', 'projectTemplates')]),
  family('global', [], 'pending-adapter', 'Shared navigation and UI controls need semantic UI helpers, not a synthetic resource endpoint.'),
  family('host', [project('host', 'hosts', ['hostname', 'agentState', 'memory', 'milliCpu', 'localStorageMb']), global('machineDriver', 'machineDrivers', ['active', 'builtin'])]),
  family('load-balancer', [project('loadBalancerService', 'loadBalancerServices', ['scale', 'healthState', 'archived'], {type: 'stack', field: 'stackId'})]),
  family('mfa-passkey', [], 'human-ceremony', 'MFA enrollment, challenges, recovery codes and passkeys require the existing human security flow.'),
  family('network', [project('network', 'networks', ['kind', 'defaultPolicyAction'])]),
  family('oidc', [], 'pending-adapter', 'OIDC configuration metadata requires the dedicated authentication API adapter. Login is a human ceremony.'),
  family('orchestration', [project('kubernetesStack', 'kubernetesStacks', ['namespace'])], 'pending-adapter', 'Orchestration APIs require a dedicated adapter.'),
  family('processes', [global('processExecution', 'processExecutions', [], ['Only basic id/created metadata; named process summaries and errors need a dedicated adapter. Raw logs are excluded.']), global('processPool', 'processPools', ['activeTasks', 'poolSize', 'queueSize'])],
    'pending-adapter', 'Process execution currently exposes only basic id/created metadata. Joined process names, summaries and errors need a dedicated adapter; raw logs are excluded. Process pool metadata is implemented.'),
  family('registry', [project('registry', 'registries')]),
  family('secrets', [project('secret', 'secrets')]),
  family('service', [project('service', 'services', ['scale', 'healthState', 'archived'], {type: 'stack', field: 'stackId'}),
    resource('dnsService', 'dnsServices', 'project', ['scale', 'healthState', 'archived', 'targetServices', 'linkedServiceCount', 'unresolvedTargetCount'], {type: 'stack', field: 'stackId'}, ['Two-step Alias workflow: create makes an empty stopped Alias with no targets; update_targets needs selected same-session serviceRefs and another human-approved plan. Start is optional and separate. Named/ported/remote links and incoming-consumer cleanup remain pending.']), resource('externalService', 'externalServices', 'project', ['scale', 'healthState', 'archived', 'hostname', 'externalIpAddresses'], {type: 'stack', field: 'stackId'}, ['Typed changes cover name/description and safe DNS/IP targets. Health checks, cloning and advanced settings remain pending. Create is inactive until a separately approved start.'])]),
  family('settings', [global('setting', 'settings', ['source', 'inDb'])]),
  family('stack', [project('stack', 'stacks', ['system', 'archived'])]),
  family('storage', [project('volume', 'volumes', ['isHostPath', 'isNative']),
    project('storagePool', 'storagePools'), project('backupTarget', 'backupTargets'), project('snapshot', 'snapshots'), project('backup', 'backups')]),
  family('terminal-logs', [], 'pending-adapter', 'Bounded log reads need a dedicated redaction and stream adapter; interactive terminals require the human UI.'),
  family('virtualmachine', [project('virtualMachine', 'virtualMachines', ['vcpu', 'memoryMb'])]),
  family('webhooks', [], 'pending-adapter', 'Webhook metadata requires the dedicated webhook API adapter; receiver tokens are never tool output.'),
]);

export const RESOURCE_TYPES = Object.freeze([...new Set(RESOURCE_FAMILIES.flatMap((entry) => entry.resources.map((item) => item.type)))]);
export function resourceFamily(name) { return RESOURCE_FAMILIES.find((entry) => entry.name === name); }
export function resourceDescriptor(familyName, type) {
  const entry = resourceFamily(familyName);
  return entry && entry.resources.find((item) => item.type === (type || entry.resources[0] && entry.resources[0].type));
}
export function resourceDescriptors() { return RESOURCE_FAMILIES.flatMap((entry) => entry.resources); }

const action = (fields = [], required = [], minFields = 0) => Object.freeze({fields: Object.freeze(fields), required: Object.freeze(required), minFields});
const metadata = action(['name', 'description'], [], 1);
export const RESOURCE_CHANGES = Object.freeze({
  certificate: Object.freeze({update_metadata: metadata}),
  stack: Object.freeze({start: action(), stop: action(), remove: action(), archive: action(), restore: action(), create: action(['name', 'description'], ['name']),
    create_from_catalog: action(['name', 'description', 'startOnCreate', 'answers'], ['name']), update_metadata: metadata}),
  service: Object.freeze({start: action(), stop: action(), restart: action(), remove: action(), archive: action(), restore: action(), scale: action(['scale'], ['scale']),
    create: action(['name', 'image', 'scale', 'description', 'command', 'entryPoint'], ['name', 'image']), update_metadata: metadata}),
  dnsService: Object.freeze({start: action(), stop: action(), remove: action(), update_metadata: metadata,
    create: action(['name', 'description'], ['name']), update_targets: action(['serviceRefs'], ['serviceRefs'])}),
  externalService: Object.freeze({start: action(), stop: action(), remove: action(), update_metadata: metadata,
    create: action(['name', 'description', 'hostname', 'externalIpAddresses'], ['name']),
    update_targets: action(['hostname', 'externalIpAddresses'], [], 1)}),
  container: Object.freeze({start: action(), stop: action(), restart: action(), remove: action(),
    create: action(['name', 'image', 'description', 'command', 'entryPoint'], ['name', 'image']), update_metadata: metadata}),
});
export const CHANGE_OPERATIONS = Object.freeze([...new Set(Object.values(RESOURCE_CHANGES).flatMap((entry) => Object.keys(entry)))]);
export const RESOURCE_CHANGE_FIELDS = Object.freeze(['name', 'description', 'hostname', 'externalIpAddresses', 'targetServices', 'image', 'scale', 'command', 'entryPoint', 'stackId', 'archived',
  'state', 'operation', 'childServiceState', 'startOnCreate', 'affectedServiceCount', 'emptyStack', 'affectedInstanceCount', 'affectedMountCount', 'mountedDataRule']);

// Only scalar allowlisted values cross the boundary. Nested structures can
// contain credentials (including audit payloads, stack YAML and key policies).
export function safeResourceFields(body, descriptor) {
  const result = {};
  for ( const field of descriptor.fields ) {
    const value = body[field];
    if ( typeof value === 'string' ) { result[field] = value.slice(0, field === 'targetServices' ? 100000 : ['description', 'externalIpAddresses'].includes(field) ? 1024 : 512); }
    else if ( typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || value === null ) { result[field] = value; }
  }
  return result;
}
export function truncatedResourceFields(body, descriptor) {
  return descriptor.fields.filter((field) => typeof body[field] === 'string' && body[field].length > (field === 'targetServices' ? 100000 : ['description', 'externalIpAddresses'].includes(field) ? 1024 : 512));
}
