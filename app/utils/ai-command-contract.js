// Business contract. This file deliberately has no browser/Ember dependency.
import { RESOURCE_FAMILIES, RESOURCE_TYPES, RESOURCE_CHANGES, CHANGE_OPERATIONS } from './ai-resource-registry';
export const COMMAND_VERSION = '1.0';
export const MAX_PAGE_SIZE = 50;

const string = (description, maxLength = 256) => ({type: 'string', minLength: 1, maxLength, description});
const schema = (properties, required = []) => ({type: 'object', properties, required, additionalProperties: false});
const commandArray = {type: 'array', maxItems: 64, 'x-maxTotalLength': 16384,
  items: {type: 'string', minLength: 0, maxLength: 4096, pattern: '^[^\\u0000]*$'},
  description: 'Create only. At most 64 strings, each up to 4096 UTF-16 units, total up to 16384. NUL is forbidden. These exact arguments appear in the human review.'};
const servicePorts = {type: 'array', maxItems: 64,
  items: {type: 'string', minLength: 1, maxLength: 128, pattern: '^[^\\u0000\\r\\n]+$'},
  description: 'Service create only. Native PortSpec strings, for example ["8080:80/tcp", "53:53/udp", "80/tcp"]. An omitted host port lets the native service allocate it automatically. At most 64 entries of 1 through 128 UTF-16 units. [] publishes no ports. The server validates native port numbers, ranges and bindings. Do not send objects, URLs or launchConfig.'};
const healthInteger = (description, minimum = 1) => ({type: 'integer', minimum, maximum: 2147483647, description});
const serviceHealthCheck = {...schema({
  port: {type: 'integer', minimum: 1, maximum: 65535, description: 'Container port to check; required. Example: 80.'},
  requestLine: {type: 'string', minLength: 0, maxLength: 1024, pattern: '^[^\\u0000\\r\\n]*$', description: 'Optional exact HTTP request line, for example "GET /health HTTP/1.0". Omit or use "" for a TCP check. No CR, LF or NUL.'},
  responseTimeout: healthInteger('Response timeout in milliseconds, 1 through 2147483647.'),
  interval: healthInteger('Check interval in milliseconds, 1 through 2147483647.'),
  healthyThreshold: healthInteger('Number of consecutive successful checks, 1 through 2147483647.'),
  unhealthyThreshold: healthInteger('Number of consecutive failed checks, 1 through 2147483647.'),
  initializingTimeout: healthInteger('Initialization timeout in milliseconds, 0 through 2147483647.', 0),
  reinitializingTimeout: healthInteger('Reinitialization timeout in milliseconds, 0 through 2147483647.', 0),
  strategy: {...string('On failure: none does nothing; recreate replaces the unhealthy container. Omitted means native recreate.', 8), enum: ['none', 'recreate']},
}, ['port']), description: 'Service create only. Closed native health-check subset. Example: {"port":80,"requestLine":"GET /health HTTP/1.0","interval":2000,"responseTimeout":2000,"healthyThreshold":2,"unhealthyThreshold":3,"strategy":"recreate"}. Omit healthCheck for no check. Null, arbitrary headers, credentials and quorum configuration are not supported.'};
export const EXTERNAL_SERVICE_HEALTH_CHECK = {...schema({
  port: {type: 'integer', minimum: 1, maximum: 65535, description: 'External target TCP port; required.'},
  interval: healthInteger('TCP check interval in milliseconds.'),
  responseTimeout: healthInteger('TCP response timeout in milliseconds.'),
  healthyThreshold: healthInteger('Consecutive successful TCP checks.'),
  unhealthyThreshold: healthInteger('Consecutive failed TCP checks.'),
}, ['port']), description: 'External Service create only. Closed TCP health check, used only when this External Service is a load-balancer backend; it is not standalone monitoring. Optional timings and thresholds use the positive-integer typed subset, 1 through 2147483647. Omit healthCheck for no check; omitted fields are not filled in by the adapter. HTTP requestLine, Host, URL, strategy, unknown fields and null are forbidden.'};

export function validateExternalServiceHealthCheck(value) {
  validateValue(value, EXTERNAL_SERVICE_HEALTH_CHECK, 'parameters.healthCheck');
}

// Reuse the tool schema when verifying the server's JSON review values.
export function validateServiceCreateField(field, value) {
  const spec = field === 'ports' ? servicePorts : field === 'healthCheck' ? serviceHealthCheck : null;
  validateValue(value, spec, `parameters.${field}`);
}
export const SERVICE_UPGRADE_FIELDS = Object.freeze(['startFirst', 'batchSize', 'intervalMillis']);
const upgradeInteger = (description, minimum) => ({type: 'integer', minimum, maximum: Number.MAX_SAFE_INTEGER, description});
const upgradeFields = {
  startFirst: {type: 'boolean', description: 'Optional image-upgrade strategy. Start replacement containers before stopping old ones. Omitted means false; native port and volume capacity checks still apply.'},
  batchSize: upgradeInteger('Optional containers per upgrade batch, at least 1. Omitted means 1. The upper bound is JSON safe-integer precision, not a native product limit.', 1),
  intervalMillis: upgradeInteger('Optional interval between upgrade batches in milliseconds, at least 100. Omitted means 2000. The upper bound is JSON safe-integer precision, not a native product limit.', 100),
};
export function validateServiceUpgradeStrategy(value) {
  validateValue(value, schema(upgradeFields, SERVICE_UPGRADE_FIELDS), 'upgradeStrategy');
}
const catalogAnswers = {type: 'array', maxItems: 100, items: schema({questionRef: string('questionRef from the selected version launchOptions.'),
  value: {type: ['string', 'number', 'boolean'], minLength: 0, maxLength: 4096, minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER}, resourceRef: string('An authorized resourceRef, or a same-session serviceRef for service questions. Never send a raw resource ID.')}, ['questionRef']),
description: 'Typed answers only. Each questionRef accepts exactly one value or resourceRef. For an optional reference, value "" explicitly selects no resource. Human-only inputs must be completed in the console; never send a password or secret value.'};
const auditFilters = schema({
  keyRef: string('Optional apiKey or apiKeyRestricted resourceRef returned by find_resources in api-keys with the intended resourceType; never supply a raw credential ID.'),
  environmentRef: string('Optional visible project resourceRef; current environment is used by default.'),
  environmentScope: {...string('Use current by default. all-visible explicitly requests only environments allowed by the native audit owner.'), enum: ['current', 'all-visible']},
  from: string('Range start, inclusive, RFC3339 with timezone; supply together with to.', 64),
  to: string('Range end, exclusive, RFC3339 with timezone; at most 366 days after from.', 64),
  lastMinutes: {type: 'integer', minimum: 1, maximum: 527040, description: 'Relative range. Do not combine with from/to. Omitted range means the last 24 hours.'},
  decision: {...string('Exact authorization decision.'), enum: ['ALLOW', 'DENY', 'NOT_EVALUATED']},
  outcome: {...string('Exact outcome, such as SUCCEEDED, FAILED or UNKNOWN.', 160), pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'},
  operation: {...string('Exact native audit operation.'), enum: ['read', 'create', 'update', 'delete', 'upgrade', 'execute']},
  targetType: {...string('Optional exact target type, such as service or stack.', 160), pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'},
  requestId: {...string('Optional exact correlation request ID from safe metadata.', 160), pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'},
  httpStatus: {type: 'integer', minimum: 100, maximum: 599, description: 'Exact HTTP response status.'},
  limit: {type: 'integer', minimum: 1, maximum: 50, description: 'Page size, maximum 50. Reuse nextCursor with unchanged filters.'},
});
export const COMMANDS = Object.freeze([
  {name: 'list_capabilities', description: 'List the closed resource families, their implementation coverage and current read availability. Pending adapters are not implemented. Does not change environment or expose credentials.', inputSchema: schema({})},
  {name: 'find_resources', description: 'Find visible resource metadata in a named family. resourceType defaults to the first type listed by list_capabilities. In api-keys, select apiKey for legacy Keys or apiKeyRestricted for restricted or expiring Keys; the default searches apiKey only, without combining kinds. Return all same-name candidates within the selected type; never select the first automatically. In catalog, find catalogTemplate by name first, then list catalogTemplateVersion with its resourceRef as parentRef and no query. Version metadata does not establish compatibility. Parent and cursor references must be reused unchanged.',
    inputSchema: schema({family: {...string('Family from list_capabilities.'), enum: RESOURCE_FAMILIES.map((item) => item.name)},
      resourceType: {...string('Optional type within that family, from list_capabilities.'), enum: RESOURCE_TYPES},
      query: string('Optional resource name words.'), parentRef: string('Optional resourceRef of the parent type listed by list_capabilities.'),
      cursor: string('The previous nextCursor, unchanged with the same family, type, query, parent and audit filters.'),
      auditFilters: {...auditFilters, description: 'Only family audit / auditLog. Explicitly query the native audit broker with these typed filters; do not combine with name query or parentRef. Available through the native browser session and the dedicated API Key bridge when matching Engine and broker audit-query components are installed. Current actor permission, Key scope and policy revision still apply. Request/response payloads remain human-only.'}}, ['family'])},
  {name: 'get_resource', description: 'Read safe metadata from a resourceRef returned by find_resources. Description is preserved through 1024 UTF-16 units. Check truncatedFields and never construct an append or replacement from truncated text. Secrets, API keys, tokens, environment variables and raw configuration are never returned. Volume detail may include at most 50 freshly authorized container usage references with context-bound containerRef, container mount destination and readOnly. Usage completeness is always unknown: an empty or truncated result never means unused, safe to remove, or no hidden users. Resolve duplicate names by the authorized Stack name and containerRef; never guess IDs or change the native deletion oracle.',
    inputSchema: schema({resourceRef: string('Opaque resourceRef from find_resources, unchanged.')}, ['resourceRef'])},
  {name: 'preview_resource_change', write: true, description: 'Preview a typed stack, service, externalService, dnsService (Alias) or container change. A human must approve the exact server plan before apply. create needs name (and image for service/container); service/externalService/dnsService create also needs parentRef of its stack. Only service create accepts ports (native PortSpec string array) and the Service healthCheck subset. External Service create accepts only a load-balancer-backend TCP healthCheck (not standalone monitoring) with required port and optional interval, responseTimeout, healthyThreshold, unhealthyThreshold; no HTTP fields, strategy or health-check update. These fields require matching server support and are shown in human review. Existing service settings use upgrade, never update_metadata or a raw launchConfig. Alias create makes an empty stopped Alias without targets; after verification use update_targets with serviceRefs for a separately approved target binding. External Service create requires exactly one hostname or nonempty externalIpAddresses, without an image. Plain create makes stopped workloads; start needs a separate plan. Catalog stack create_from_catalog needs catalogVersionRef and typed answers; startOnCreate explicitly controls service startup. Stack/service archive requires completely stopped workloads and empty parameters; it never stops or deletes them. restore clears only the target archive flag, does not start it or change parent/child flags. Other operations require targetRef. Credentials, raw IDs and arbitrary configuration are not accepted.',
    inputSchema: {...schema({resourceType: {...string('Resource type from list_capabilities.'), enum: Object.keys(RESOURCE_CHANGES)},
      operation: {...string('A supported operation from list_capabilities.'), enum: CHANGE_OPERATIONS},
      targetRef: string('Existing resourceRef for operations on an existing resource. Do not provide for create or create_from_catalog.'), parentRef: string('Stack resourceRef, required for service, externalService or dnsService create.'),
      catalogVersionRef: string('Selected catalogTemplateVersion resourceRef, required only for stack create_from_catalog. Call get_resource on it first for safe questions.'),
      parameters: schema({name: string('Exact resource name.', 255), description: {type: ['string', 'null'], minLength: 0, maxLength: 1024, description: 'Full description. Empty string and null are distinct.'},
        image: string('Exact image requested by the user. Required for service/container create.', 512), scale: {type: 'integer', minimum: 0, maximum: 100, description: 'Service scale, 0 through 100.'},
        hostname: string('DNS hostname only, without a scheme, userinfo, port, path, query or fragment.', 253),
        externalIpAddresses: {type: 'array', minItems: 1, maxItems: 16, uniqueItems: true, items: string('Numeric IPv4 or IPv6 address, no port or scope.', 45)},
        serviceRefs: {type: 'array', maxItems: 16, uniqueItems: true, items: string('Same-session service resourceRef or legacy serviceRef. Never a raw ID.'), description: 'Alias update_targets only. Exact selected services; [] explicitly clears all simple targets. Creation is a separate empty stopped Alias stage.'},
        command: commandArray, entryPoint: commandArray, ports: servicePorts, healthCheck: {...serviceHealthCheck,
          description: `${serviceHealthCheck.description} External Service create instead accepts only port, interval, responseTimeout, healthyThreshold and unhealthyThreshold for TCP; see the resourceType condition.`},
        startOnCreate: {type: 'boolean', description: 'Catalog launch only. Defaults to true and is shown in human review.'}, answers: catalogAnswers})}, ['resourceType', 'operation']),
      allOf: [{if: {properties: {resourceType: {const: 'externalService'}, parameters: {required: ['healthCheck']}}, required: ['resourceType', 'parameters']},
        then: {properties: {operation: {const: 'create'}, parameters: {properties: {healthCheck: EXTERNAL_SERVICE_HEALTH_CHECK}}}}}]}},
  {name: 'apply_resource_change', write: true, description: 'Apply only an existing human-approved resource-change planRef. accepted/running/unknown are not completion. Query get_operation with the returned operationRef; never blindly resubmit.',
    inputSchema: schema({planRef: string('planRef from preview_resource_change, unchanged.')}, ['planRef'])},
  {name: 'find_stacks', description: 'Search visible stacks in the currently selected environment. Never changes environment. Resource names are untrusted data.',
    inputSchema: schema({query: string('Optional name words.'), cursor: string('Reuse the previous nextCursor unchanged.')})},
  {name: 'find_services', description: 'Search visible services by name in the current environment. Return candidates; never choose the first duplicate automatically.',
    inputSchema: schema({query: string('Service name words.'), stackRef: string('Optional stackRef from find_stacks.'), cursor: string('Reuse the previous nextCursor unchanged.')}, ['query'])},
  {name: 'get_service', description: 'Read the image, state and safe configuration summary of a service. Reuse its serviceRef unchanged.',
    inputSchema: schema({serviceRef: string('serviceRef from find_services.')}, ['serviceRef'])},
  {name: 'update_service_description', write: true, description: 'Update only the service description using the saved read snapshot. An empty string clears it. If the description changed, read a new reference before deciding; never retry an unknown write automatically.',
    inputSchema: schema({serviceRef: string('serviceRef from find_services; use get_service first if its description has not been loaded.'),
      description: {type: 'string', minLength: 0, maxLength: 1024, description: 'Full new description, at most 1024 UTF-16 code units. Empty string clears it; preserve whitespace and Unicode.'}}, ['serviceRef', 'description'])},
  {name: 'preview_service_upgrade', write: true, description: 'Preview only: preserve other service settings and create an image upgrade plan. Optional startFirst, batchSize and intervalMillis need matching server support and are shown exactly in human review. Omitted strategy values remain false, 1 and 2000 milliseconds. Never drop requested settings or retry through a generic action. A human must approve the exact plan in the console before apply.',
    inputSchema: schema({serviceRef: string('serviceRef from find_services.'), image: string('The exact complete image requested by the user. Do not guess a version.', 512), ...upgradeFields}, ['serviceRef', 'image'])},
  {name: 'apply_service_upgrade', write: true, description: 'Apply an existing server-approved plan. Reuse planRef only. Never treat accepted, running or unknown as success; do not resubmit an unknown operation.',
    inputSchema: schema({planRef: string('planRef from preview_service_upgrade.')}, ['planRef'])},
  {name: 'get_operation', description: 'Read the same operation until the server verifies its result. accepted, running and unknown are not success.',
    inputSchema: schema({operationRef: string('operationRef returned by apply_service_upgrade.')}, ['operationRef'])},
]);

const ERRORS = {
  INVALID_INPUT: ['Correct the named field using this tool schema.', 'rejected'],
  UNAVAILABLE: ['Use the normal console, or select an environment and enable this integration.', 'rejected'],
  CONTEXT_CHANGED: ['The session or environment changed. Search again in the current environment.', 'rejected'],
  STALE_REFERENCE: ['Search again and reuse the new reference unchanged.', 'rejected'],
  FORBIDDEN: ['This operation is unavailable to the current account. Do not try another ID or environment.', 'rejected'],
  SESSION_REQUIRED: ['Sign in through the normal console.', 'rejected'],
  CONFLICT: ['The resource or plan changed. Preview again and ask for a new human confirmation.', 'rejected'],
  CAPACITY: ['Cancel unused pending plans using Cancel plan in the console AI collaboration panel, or wait for them to expire. Do not create more plans.', 'rejected'],
  NEEDS_USER: ['Ask the user to review and confirm the plan in the console.', 'needs_user'],
  INVALID_RESPONSE: ['The server response could not be verified. Use the normal console.', 'unknown'],
  UNKNOWN_RESULT: ['The request outcome is unknown. Check the existing operation in the console; do not blindly retry.', 'unknown'],
  CANCELLED: ['The local tool invocation was cancelled. A submitted operation may still be running.', 'unknown'],
};
export const PUBLIC_ERROR_CODES = Object.freeze(Object.keys(ERRORS));

export class CommandError extends Error {
  constructor(code, field) { super(code); this.code = code; this.field = field; }
}

export function publicError(error) {
  let code = error instanceof CommandError ? error.code : null;
  const status = Number(error && (error.status || error.statusCode || (error.response && error.response.status)));
  if ( !code ) {
    // rawRequest/rawFetch rejects {status, body, statusText, headers}. Only
    // exact public server codes from a confirmed 4xx are mapped; body text,
    // messages, detail and arbitrary codes never leave this boundary.
    const serverCode = error && error.body && typeof error.body === 'object' ? error.body.code : null;
    const known = {
      UpgradeNeedsConfirmation: 'NEEDS_USER',
      UpgradeInputInvalid: 'INVALID_INPUT',
      UpgradePlanExpired: 'CONFLICT',
      UpgradePlanStale: 'CONFLICT',
      UpgradeCancelled: 'CONFLICT',
      ResourceChangeNeedsConfirmation: 'NEEDS_USER',
      ResourceChangePlanExpired: 'CONFLICT',
      ResourceChangePlanStale: 'CONFLICT',
      ResourceChangeTargetBusy: 'CONFLICT',
      ResourceChangeQuotaExceeded: 'CAPACITY',
      ResourceChangeCancelled: 'CONFLICT',
      ResourceChangeUnsupported: 'UNAVAILABLE',
      ResourceChangeInputInvalid: 'INVALID_INPUT',
      ResourceViewNarrowQuery: 'INVALID_INPUT',
      CatalogMetadataInputInvalid: 'INVALID_INPUT',
      CatalogMetadataCursorStale: 'STALE_REFERENCE',
      CatalogMetadataFineGrainedUnsupported: 'UNAVAILABLE',
      CatalogLaunchInputInvalid: 'INVALID_INPUT',
      CatalogLaunchOptionUnknown: 'STALE_REFERENCE',
      CatalogLaunchNeedsHumanInputs: 'NEEDS_USER',
      CatalogLaunchNeedsConfirmation: 'NEEDS_USER',
      CatalogLaunchSourceChanged: 'CONFLICT',
      CatalogLaunchPlanExpired: 'CONFLICT',
      CatalogLaunchUnsupported: 'UNAVAILABLE',
      ArchiveRequiresStopped: 'CONFLICT',
      ArchiveSystemResource: 'UNAVAILABLE',
      ArchiveMixedUpdate: 'INVALID_INPUT',
      ArchiveConcurrentChange: 'CONFLICT',
      ResourceArchived: 'CONFLICT',
    };
    code = status === 503 && ['ResourceChangeFeatureDisabled', 'CatalogMetadataUnavailable'].includes(serverCode) ? 'UNAVAILABLE' :
      status === 401 ? 'SESSION_REQUIRED' : [403, 404].includes(status) ||
      status === 405 && serverCode === 'Method not allowed' ? 'FORBIDDEN' :
      status >= 400 && status < 500 && typeof serverCode === 'string' && Object.prototype.hasOwnProperty.call(known, serverCode) ? known[serverCode] :
      [400, 422].includes(status) ? 'INVALID_INPUT' :
      [409, 410, 412].includes(status) ? 'CONFLICT' : 'UNKNOWN_RESULT';
  }
  const entry = ERRORS[code] || ERRORS.UNKNOWN_RESULT;
  const result = {status: entry[1], code, nextStep: entry[0], contractVersion: COMMAND_VERSION};
  const serverCode = error && error.body && error.body.code;
  if ( ['FORBIDDEN', 'CONTEXT_CHANGED'].includes(code) && serverCode === 'ApiKeyPolicyChanged' ) {
    result.nextStep = 'The API Key policy changed. Stop this request and ask the user to review the Key and reconnect the bridge with its current policy. Do not retry automatically, broaden permissions, or try another ID or environment.';
  }
  if ( code === 'UNAVAILABLE' && serverCode === 'ResourceChangeFeatureDisabled' ) {
    result.nextStep = 'Resource changes are disabled on this server. Ask an operator to enable the feature, or use the normal console.';
  }
  if ( code === 'UNAVAILABLE' && status === 422 && error && error.body && error.body.code === 'ResourceChangeUnsupported' ) {
    result.nextStep = 'This operation is unsupported for this resource. Do not retry the same plan. If the request is service scale, Global services deploy according to eligible hosts and do not support a manual instance count. Review the service deployment configuration or eligible hosts in the console; do not guess another scale value.';
  }
  if ( code === 'UNAVAILABLE' && serverCode === 'CatalogMetadataUnavailable' ) {
    result.nextStep = 'Catalog metadata is unavailable on this server. Use the normal console or try this read after the service recovers.';
  }
  if ( code === 'UNAVAILABLE' && serverCode === 'CatalogMetadataFineGrainedUnsupported' ) {
    result.nextStep = 'This fine-grained Catalog selector is not supported. Use the normal console or ask an administrator to review the existing policy. Do not broaden the Key policy or try other IDs.';
  }
  if ( code === 'UNAVAILABLE' && serverCode === 'CatalogLaunchUnsupported' ) {
    result.nextStep = 'This Catalog launch graph is not supported by this adapter. Existing external volume references (external=true) are pending support. Use the normal console for this template; do not guess replacement IDs, rewrite its files or retry the same plan.';
  }
  if ( code === 'STALE_REFERENCE' && serverCode === 'CatalogMetadataCursorStale' ) {
    result.field = 'cursor';
    result.nextStep = 'Call find_resources in the catalog family again without a cursor. Select the exact template resourceRef again before listing its versions. Do not reuse the old cursor or guess IDs.';
  }
  if ( ['CatalogLaunchNeedsHumanInputs', 'CatalogLaunchNeedsConfirmation'].includes(serverCode) && code === 'NEEDS_USER' ) {
    result.nextStep = 'Ask the user to open this plan in the console, complete human-only inputs and approve the exact rendered launch. Never ask the model to supply passwords or secret defaults.';
  }
  if ( ['CatalogLaunchOptionUnknown', 'CatalogLaunchSourceChanged', 'CatalogLaunchPlanExpired'].includes(serverCode) && ['STALE_REFERENCE', 'CONFLICT'].includes(code) ) {
    result.nextStep = 'Find the exact catalog template and version again, then call get_resource for new launchOptions and questionRefs. Preview a new plan for human approval; do not reuse old inputs or guess defaults.';
  }
  if ( code === 'CONFLICT' && error && error.body && error.body.code === 'ResourceChangeTargetBusy' ) {
    result.reason = 'TARGET_BUSY';
    result.nextStep = 'Wait for the current operation to finish. If you have its operationRef, call get_operation with it. Then read the resource again before previewing. Do not submit parallel changes.';
  }
  const archiveCode = error && error.body && error.body.code;
  if ( code === 'CONFLICT' && archiveCode === 'ArchiveRequiresStopped' ) {
    result.nextStep = 'Archive requires every related service and container to be completely stopped. Do not automatically stop anything or retry archive. Ask whether the user wants a separate stop plan, wait for its verified completion, then find and read the target again before previewing archive.';
  }
  if ( code === 'UNAVAILABLE' && archiveCode === 'ArchiveSystemResource' ) {
    result.nextStep = 'System and infrastructure resources cannot be archived. Do not try another ID or change permissions. This archive restriction does not prohibit restoring an existing archive flag.';
  }
  if ( code === 'INVALID_INPUT' && archiveCode === 'ArchiveMixedUpdate' ) {
    result.field = 'parameters';
    result.nextStep = 'Preview archive or restore separately with an existing targetRef and empty parameters. Do not include a service clone, archive flag or other settings.';
  }
  if ( code === 'CONFLICT' && archiveCode === 'ArchiveConcurrentChange' ) {
    result.nextStep = 'The resource or parent stack changed. Find and read the target and its parent again, then preview a new plan for human approval. Do not reuse the old plan or retry it blindly.';
  }
  if ( code === 'CONFLICT' && archiveCode === 'ResourceArchived' ) {
    result.nextStep = 'The target or its parent stack is archived. Find and read both flags. Each restore affects only its exact target and needs human approval; it never restores children or parents automatically and never starts a workload.';
  }
  if ( code === 'INVALID_INPUT' && error && error.body && error.body.code === 'ResourceViewNarrowQuery' ) {
    result.field = 'query';
    result.nextStep = 'Call find_resources again with a narrower query, such as the exact resource name, in the same family. Do not guess IDs or switch environments.';
  }
  if ( error instanceof CommandError && error.field ) { result.field = error.field; }
  if (error instanceof CommandError && error.field === 'auditFilters.transport') {
    result.nextStep = 'Use the current native browser session or the dedicated stdio bridge. The server must authorize audit reads and any target Key metadata under current permissions. Do not forge identity headers or treat a rejected query as complete.';
  } else if (error instanceof CommandError && error.field === 'auditFilters.service') {
    result.nextStep = 'The native audit owner is temporarily unavailable. This read query did not establish any result. Retry a bounded read after service recovery with the same Key/environment filters; do not change permissions or infer that zero events exist.';
  } else if (error instanceof CommandError && error.field === 'auditFilters.audit') {
    result.nextStep = 'The server could not durably record the query audit evidence. No successful query result was admitted. Ask the operator to restore the existing audit store; preserve the same filters and permissions.';
  } else if (error instanceof CommandError && error.field === 'auditFilters.timeRange') {
    result.nextStep = 'Use lastMinutes or a complete from/to timezone range within 366 days. Narrow the time range and visible environment if the native 20,000-row scan bound is reached; keep the intended Key and permission filters.';
  } else if (error instanceof CommandError && error.field && error.field.startsWith('auditFilters')) {
    result.nextStep = 'Call find_resources with family audit, resourceType auditLog and auditFilters. Reuse authorized API Key/project resourceRefs, choose a bounded time range and keep filters unchanged with nextCursor. Do not send raw IDs, URLs or payload fields.';
  }
  if (code === 'FORBIDDEN' && serverCode === 'ai_audit_cookie_required') {
    result.nextStep = 'The server is using the earlier Cookie-only audit adapter. The dedicated bridge needs the matching Engine and broker audit-query components. Do not forge a Cookie, switch credentials or treat this denial as a successful query.';
  }
  return result;
}

export function validateInput(name, input) {
  const command = COMMANDS.find((item) => item.name === name);
  if ( !command ) { throw new CommandError('INVALID_INPUT'); }
  validateValue(input, command.inputSchema);
  return command;
}

function validateValue(value, spec, field) {
  if ( !spec ) { throw new CommandError('INVALID_INPUT', field); }
  const types = Array.isArray(spec.type) ? spec.type : [spec.type];
  if ( value === null && types.includes('null') ) { return; }
  if ( types.includes('array') ) {
    if ( !Array.isArray(value) || value.length > spec.maxItems ) { throw new CommandError('INVALID_INPUT', field); }
    value.forEach((item, index) => validateValue(item, spec.items, `${field}[${index}]`));
    if ( spec['x-maxTotalLength'] !== undefined && value.reduce((total, item) => total + item.length, 0) > spec['x-maxTotalLength'] ) { throw new CommandError('INVALID_INPUT', field); }
    return;
  }
  if ( types.includes('object') ) {
    if ( !value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ) { throw new CommandError('INVALID_INPUT', field); }
    for ( const key of Object.keys(value) ) {
      if ( !Object.prototype.hasOwnProperty.call(spec.properties, key) ) { throw new CommandError('INVALID_INPUT', field || key); }
      validateValue(value[key], spec.properties[key], field ? `${field}.${key}` : key);
    }
    for ( const key of spec.required ) {
      if ( !Object.prototype.hasOwnProperty.call(value, key) || spec.properties[key].minLength > 0 && !value[key].trim() ) { throw new CommandError('INVALID_INPUT', field ? `${field}.${key}` : key); }
    }
    return;
  }
  if ( types.includes('string') && typeof value === 'string' && value.length >= spec.minLength && value.length <= spec.maxLength &&
    (!spec.enum || spec.enum.includes(value)) && (!spec.pattern || new RegExp(spec.pattern, 'u').test(value)) ) { return; }
  if ( types.includes('integer') && Number.isInteger(value) && value >= spec.minimum && value <= spec.maximum ) { return; }
  if ( types.includes('number') && typeof value === 'number' && Number.isFinite(value) &&
    (spec.minimum === undefined || value >= spec.minimum) && (spec.maximum === undefined || value <= spec.maximum) ) { return; }
  if ( types.includes('boolean') && typeof value === 'boolean' ) { return; }
  throw new CommandError('INVALID_INPUT', field);
}

export function safeText(value, limit = 256) { return typeof value === 'string' ? value.slice(0, limit) : ''; }
