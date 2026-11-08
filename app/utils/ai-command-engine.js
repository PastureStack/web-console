import {validateExternalServiceParameters, isExternalHostname, isExternalAddress} from './ai-external-service';
import {aliasTargetIds, ordinaryServiceLinks, safeAliasTargetSummary, ALIAS_WORKFLOW, ALIAS_CREATE_NEXT_STEP} from './ai-alias-service';
import { COMMANDS, COMMAND_VERSION, MAX_PAGE_SIZE, SERVICE_UPGRADE_FIELDS, SERVICE_UPGRADE_CONFIG_FIELDS, CommandError, publicError, safeText, validateInput, validateServiceCreateField, validateExternalServiceHealthCheck, validateServiceUpgradeStrategy, validateTcpLoadBalancerRules, validateTcpLoadBalancerReview, TCP_LOAD_BALANCER_CREATE } from './ai-command-contract';
import { RESOURCE_FAMILIES, RESOURCE_CHANGES, RESOURCE_CHANGE_FIELDS, SERVICE_UPGRADE_LIFECYCLE, STACK_UPGRADE_LIFECYCLE, resourceFamily, resourceDescriptor, safeResourceFields, safeRegistryAddress, truncatedResourceFields, configuredPolicyRead } from './ai-resource-registry';
import { createCatalogReader } from './ai-catalog-reader';
import { createAuditReader, AUDIT_FIELDS, auditSafeFields } from './ai-audit-reader';
import {boundedContainerLogs} from './ai-container-logs';
import { createCatalogLaunchAdapter, catalogLaunchPlanSummary, CATALOG_LAUNCH_COLLECTION } from './ai-catalog-launch';

const OPERATION_STATUSES = ['accepted', 'running', 'succeeded', 'failed', 'unknown', 'cancelled', 'needs_user'];
const APPLY_COMMANDS = ['apply_service_upgrade', 'apply_resource_change'];
const SERVICE_CREATE_FIELDS = ['ports', 'healthCheck'];

export function serviceCreateReview(summary) {
  return summary && summary.operation === 'create' && Array.isArray(summary.displayDiff) &&
    (['externalService', 'loadBalancerService', 'volume'].includes(summary.resourceType) || ['service', 'container'].includes(summary.resourceType) &&
      summary.displayDiff.some((change) => [...SERVICE_CREATE_FIELDS, 'portRules'].includes(change.field))) ?
    JSON.stringify([summary.displayPath, summary.displayDiff]) : null;
}

export function containerNetworkReview(summary) {
  return summary && ['port', 'instanceLink'].includes(summary.resourceType) &&
    ['update_public_port', 'update_target'].includes(summary.operation) && Array.isArray(summary.displayDiff) ?
    JSON.stringify([summary.resourceType, summary.operation, summary.displayPath, summary.displayDiff]) : null;
}

export function serviceUpgradeReview(summary) {
  return summary && summary.upgradeStrategy ? JSON.stringify([summary.displayPath, summary.currentImage, summary.requestedImage,
    ...SERVICE_UPGRADE_FIELDS.map((field) => summary.upgradeStrategy[field]),
    ...(summary.configurationChanges ? [summary.configurationChanges] : [])]) : null;
}

export function stackUpgradeReview(summary) {
  return summary && summary.resourceType === 'stack' && Object.prototype.hasOwnProperty.call(STACK_UPGRADE_LIFECYCLE, summary.operation) ?
    JSON.stringify([summary.resourceType, summary.operation, summary.displayPath, summary.displayDiff]) : null;
}

function upgradeConfigurationValue(field, value) {
  if ( field === 'healthCheck' && value === null ) { return null; }
  validateServiceCreateField(field, value);
  if ( field === 'ports' ) { return JSON.stringify(value); }
  const check = {strategy: 'recreate', ...value};
  return JSON.stringify(Object.fromEntries(Object.keys(check).sort().map(key => [key, check[key]])));
}

function upgradeConfigurationChanges(value) {
  if ( !Array.isArray(value) || value.length < 1 || value.length > 2 || new Set(value.map(row => row && row.field)).size !== value.length ) { throw new CommandError('INVALID_RESPONSE'); }
  try {
    return Object.freeze(value.map(row => {
      if ( !row || Object.keys(row).sort().join(',') !== 'after,before,field' || !SERVICE_UPGRADE_CONFIG_FIELDS.includes(row.field) ) { throw new CommandError('INVALID_RESPONSE'); }
      for ( const side of ['before', 'after'] ) {
        if ( row[side] !== null && (typeof row[side] !== 'string' || row[side].length > 32768) ) { throw new CommandError('INVALID_RESPONSE'); }
        upgradeConfigurationValue(row.field, row[side] === null ? null : JSON.parse(row[side]));
      }
      return Object.freeze({field: row.field, before: row.before, after: row.after});
    }));
  } catch (_invalid) { throw new CommandError('INVALID_RESPONSE'); }
}

function upgradeStrategy(value) {
  try { validateServiceUpgradeStrategy(value); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
  return Object.freeze(Object.fromEntries(SERVICE_UPGRADE_FIELDS.map((field) => [field, value[field]])));
}

class UnknownOperation extends Error {
  constructor(operationRef) { super('UNKNOWN_RESULT'); this.operationRef = operationRef; }
}

class UnknownDescriptionUpdate extends Error {}

function projectResource(item, projectId) {
  return item && typeof item.id === 'string' && (!item.accountId || item.accountId === projectId);
}

function imageName(value) { return safeText(value, 512).replace(/^docker:/, ''); }

export function waitForOperationPoll(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      if ( signal ) { signal.removeEventListener('abort', abort); }
    };
    const abort = () => { cleanup(); reject(new CommandError('CANCELLED')); };
    if ( signal && signal.aborted ) { abort(); return; }
    if ( signal ) { signal.addEventListener('abort', abort, {once: true}); }
    timer = setTimeout(() => { cleanup(); resolve(); }, milliseconds);
  });
}

// Result objects never expose the private, per-engine Project completion notice.
const projectOperationNotices = new WeakMap();

export class CommandEngine {
  constructor({context, request, ensureSession, audit = async () => { throw new CommandError('UNAVAILABLE'); }, wait = waitForOperationPoll, onPlan = () => {}, onOperation = () => {}, origin = 'https://localhost', apiEndpoint = '/v2-beta', transportKind = 'browser', browserEnvironment = null, canRenameSelectedProject = async () => false}) {
    Object.assign(this, {context, request, ensureSession, audit, wait, onPlan, onOperation, origin, apiEndpoint, transportKind, browserEnvironment, canRenameSelectedProject});
    projectOperationNotices.set(this, new WeakMap());
    this.catalogReader = createCatalogReader({request, context});
    this.auditReader = createAuditReader({request, context, transportKind,
      resolveResource: (reference, captured, field) => this.resolveResourceReference(reference, null, captured, field)});
    this.catalogLaunch = createCatalogLaunchAdapter({request, context,
      resolveResource: (reference, type, captured) => this.resolveResourceReference(reference, type, captured, 'parameters.answers')});
  }

  async execute(name, input, options = {}) {
    const startedAt = Date.now();
    const observeOperation = typeof options.onOperation === 'function' ? options.onOperation : this.onOperation;
    let captured, result, startAck, operationNotice, businessStarted = false, descriptionMayHaveSaved = false, serviceCreateInputRejected = false;
    const commandName = COMMANDS.some((item) => item.name === name) ? name : 'unknown';
    try {
      captured = this.context.capture();
      if ( options.registration ) { this.context.assertCurrent(options.registration, options.signal); }
      // Even invalid input has a bounded start/result audit pair. Neither the
      // arguments nor caller-controlled tool names enter the audit payload.
      startAck = await this.recordAudit({command: commandName, phase: 'start', status: 'pending', reason: 'NONE'}, captured);
      const command = validateInput(name, input);
      if ( command.write && captured.mode !== 'enabled' ) { throw new CommandError('UNAVAILABLE'); }
      await this.ensureSession();
      this.context.assertCurrent(captured, options.signal);
      if ( this.transportKind === 'stdio' ) { captured = this.context.capture(); }
      businessStarted = true;
      result = await this[name](input, captured, options.signal, observeOperation);
      descriptionMayHaveSaved = name === 'update_service_description' && result.saved === true;
      operationNotice = projectOperationNotices.get(this).get(result);
      projectOperationNotices.get(this).delete(result);
      this.context.assertCurrent(captured, options.signal);
      result = Object.assign({contractVersion: COMMAND_VERSION}, result);
    } catch (error) {
      const operationRef = error instanceof UnknownOperation ? error.operationRef :
        APPLY_COMMANDS.includes(name) && result && result.operationRef;
      if ( error instanceof UnknownDescriptionUpdate ) { descriptionMayHaveSaved = true; }
      if ( descriptionMayHaveSaved ) {
        result = this.unknownDescriptionOutcome();
      } else if ( operationRef ) {
        result = this.unknownOutcome(operationRef, captured);
      } else {
        // Never expose the transport error, response body, launchConfig or token.
        result = publicError(error);
        serviceCreateInputRejected = name === 'preview_resource_change' && input && ['service', 'container'].includes(input.resourceType) && input.operation === 'create' &&
          input.parameters && SERVICE_CREATE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input.parameters, field)) &&
          Number(error && (error.status || error.statusCode)) === 422 && error.body && error.body.code === 'ResourceChangeInputInvalid' && result.code === 'INVALID_INPUT';
      }
    }
    if ( name === 'preview_resource_change' && input && input.resourceType === 'volume' && ['UNAVAILABLE', 'INVALID_INPUT'].includes(result.code) ) {
      result.nextStep = 'This tool only creates an unallocated builtin local logical Volume record with name/description in this selected environment. It does not create or mount storage on a Host. Driver options, Host paths, IDs, plugin drivers and size are unsupported here; use the existing human Volume UI for those choices. Names can repeat: choose a distinct name and inspect fresh metadata/usage references without inferring that an existing volume is unused. Never change Key permissions or reuse an old same-name record as the create result.';
    }
    if ( result.reason === 'TARGET_BUSY' ) {
      const operationRef = this.existingOperation(input, captured);
      if ( operationRef ) { result.operationRef = operationRef; result.nextStep = 'Call get_operation with this existing operationRef and wait for completion. Then read the resource again before previewing. Do not submit parallel changes.'; }
    }
    if ( ['get_service', 'update_service_description'].includes(name) && result.code === 'CONFLICT' ) {
      result.nextStep = 'The service description changed. Find the service again and read its current description before deciding on an update.';
    } else if ( name === 'update_service_description' && result.code === 'STALE_REFERENCE' ) {
      result.nextStep = 'Use get_service to load this reference description first. If the reference expired, find the service again.';
    } else if ( name === 'get_resource' && result.code === 'INVALID_INPUT' && result.field === 'resourceRef' &&
      input && /^(stack|service)_/.test(input.resourceRef) ) {
      result.nextStep = 'Call find_resources with family stack or service to obtain a resourceRef, then reuse that returned resourceRef unchanged in get_resource. For a Stack graph, use family stack and get_resource with view stack_graph. stackRef from find_stacks and serviceRef from find_services belong to legacy tools; never pass them as resourceRef or change their prefix. Keep the same environment and credentials.';
    } else if ( name === 'preview_service_upgrade' && input && SERVICE_UPGRADE_CONFIG_FIELDS.some(field => Object.prototype.hasOwnProperty.call(input, field)) &&
      ['INVALID_INPUT', 'INVALID_RESPONSE'].includes(result.code) ) {
      result.nextStep = 'Use the supported typed Service upgrade subset. Omit ports/healthCheck to preserve them; [] explicitly clears ports, a nonempty healthCheck object merges only supplied fields, and null clears the entire check. A new check needs port. Use a matching Engine and exact returned review; do not drop settings, send raw launchConfig or retry through a generic Service PUT.';
    } else if ( name === 'preview_service_upgrade' && input && SERVICE_UPGRADE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input, field)) &&
      ['INVALID_INPUT', 'INVALID_RESPONSE'].includes(result.code) ) {
      result.nextStep = 'Check startFirst, batchSize and intervalMillis against this tool schema and use a matching Engine upgrade-strategy adapter. The exact strategy must be returned for human review. Do not drop requested settings, send inServiceStrategy or launchConfig, or retry through a generic action.';
    } else if ( name === 'find_resources' && input && input.family === 'catalog' && input.resourceType === 'catalogTemplateVersion' &&
      ['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code) && result.field !== 'cursor' ) {
      result.nextStep = 'Use find_resources with family catalog and resourceType catalogTemplate to find the exact named template. List catalogTemplateVersion with that template resourceRef as parentRef and no query. Select one returned version resourceRef; never guess a version or assume compatibility.';
    } else if ( name === 'preview_resource_change' && input && input.operation === 'create_from_catalog' && ['INVALID_INPUT', 'STALE_REFERENCE', 'NEEDS_USER'].includes(result.code) ) {
      if ( result.code === 'NEEDS_USER' ) {
        result.nextStep = 'Human-only answers must be completed by the user in the console. Do not ask the model to supply passwords, secret values or defaults. Preview with safe typed answers only, then let the user complete and approve that exact plan.';
      } else if ( result.field ) {
        const repairs = {
          'parameters.name': 'Provide the requested Catalog stack name in parameters.name: 1 through 63 ASCII letters, digits or dash.',
          'parameters.description': 'Provide parameters.description as a complete string of at most 1024 UTF-16 units, or omit it. An empty string clears it; null is not accepted for Catalog launch.',
          'parameters.startOnCreate': 'Provide parameters.startOnCreate as a boolean, or omit it for the normal true default. Review the exact value in the plan.',
          'parameters.answers': 'Use an array of entries with a returned questionRef and exactly one typed value or authorized resourceRef. Use find_resources to obtain the referenceType requested by the question. Same-session serviceRef values are accepted only for service questions. Human-only answers belong in the console form, never in tool arguments.',
        };
        result.nextStep = repairs[result.field] || 'Find the exact named catalogTemplate, list its catalogTemplateVersion candidates with parentRef, select one version resourceRef, then call get_resource to obtain current questionRefs. Use that version as catalogVersionRef; do not pass targetRef, parentRef, raw IDs, YAML or guessed defaults.';
      }
    } else if ( name === 'preview_resource_change' && input && input.resourceType === 'service' && input.operation === 'update_links' && result.code === 'UNAVAILABLE' ) {
      result.nextStep = 'Ordinary Service link replacement requires the matching server adapter and a completely readable plain/named-link snapshot. Port-qualified, remote, hidden or incomplete existing links are unsupported. Use the normal console; do not drop settings, infer completeness from stack_graph or retry through another operation.';
    } else if ( name === 'preview_resource_change' && input && input.resourceType === 'project' && input.operation === 'update_metadata' &&
      result.code === 'INVALID_INPUT' && result.field === 'targetRef' ) {
      result.nextStep = 'Only the currently selected environment can be edited. If the target is another visible environment, ask the user to switch environments normally, then call find_resources again for a fresh project resourceRef. Never guess an ID or modify the original reference.';
    } else if ( name === 'preview_resource_change' && input && input.operation === 'update_metadata' && RESOURCE_CHANGES[input.resourceType] && RESOURCE_CHANGES[input.resourceType].update_metadata &&
      result.code === 'INVALID_INPUT' && ['name', 'description'].includes(result.field) && Object.prototype.hasOwnProperty.call(input, result.field) ) {
      result.nextStep = 'Put name and description inside parameters, not at the top level. Keep resourceType, operation and the same selected targetRef at the top level. For example, parameters: {"name":"<requested name>","description":"<requested description>"}; description may also be null. Resubmit preview_resource_change with the corrected envelope. The resulting plan still requires the user to review and confirm it; do not apply it automatically.';
    } else if ( name === 'preview_resource_change' && !['PORT_CONFLICT', 'REFERENCE_UNAVAILABLE'].includes(result.reason) && ['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code) ) {
      const repairs = {
        'parameters.image': 'Provide the exact user-requested image in parameters.image. Ask the user if it is missing; never guess an image or version.',
        'parameters.name': 'Provide the requested name in parameters.name, from 1 to 255 UTF-16 units.',
        'parameters.scale': input.resourceType === 'loadBalancerService' ?
          'Provide an integer of at least 1 in parameters.scale for a non-Global load balancer. The native int representation ceiling is 2147483647. Scaling does not start an inactive load balancer.' :
          'Provide an integer from 0 through 100 in parameters.scale.',
        'parameters.resetName': 'To restore the displayed native hostname, use Host update_metadata with parameters: {resetName: true} and omit name. Description may be combined. Do not send false, null, text, an empty name, hostname or infrastructure fields.',
        'parameters.description': 'Provide the complete description as a string of at most 1024 UTF-16 units, or null. An empty string clears it.',
        'parameters.links': 'Use at most 16 {serviceRef,name} rows, selected by exact Stack/name. Names preserve case; null or an empty string is plain. Do not send raw IDs, port-qualified or remote links. Use either links or serviceRefs, never both; [] clears the full set.',
        'parameters.serviceRefs': 'Find each exact service by name and Stack with find_resources. Select its same-session resourceRef; never choose the first same-name candidate, guess a raw ID or reuse a stale reference. Supply at most 16 distinct serviceRefs; [] explicitly clears the complete target set.',
        operation: 'Use list_capabilities and choose an implemented operation for this resource type.',
      };
      result.nextStep = input && input.resourceType === 'service' && input.operation === 'update_links' ?
        'Use find_resources or get_resource with a Stack resourceRef and view stack_graph to select fresh generic resourceRefs for the source and each exact ordinary Service by Stack/name in this environment. Supply exactly one of parameters.serviceRefs for plain targets or parameters.links:[{serviceRef,name}] for plain/named targets, at most 16 entries; [] explicitly clears all links. Names preserve exact native alias case; null or an empty string is plain. Do not use legacy serviceRef, raw IDs, self links, other service kinds, ports or remote targets. Graph completeness stays unknown; the server must independently resolve the complete before snapshot. Review and approve a new exact plan.' :
        input && input.resourceType === 'loadBalancerService' && input.operation === 'create' ?
        'Find the exact Stack and backend services by name and Stack, and reuse their same-session parentRef/serviceRef. Provide explicit startOnCreate and 1 through 16 complete ordered rules: protocol tcp, access public or internal, sourcePort and targetPort 1 through 65535 (listener 42 is reserved). Never guess a target port, raw ID or image. HTTPS/TLS/HTTP, certificates, selectors and arbitrary configuration require the normal console; do not drop or downgrade requested settings.' :
        input && input.resourceType === 'externalService' && input.parameters && Object.prototype.hasOwnProperty.call(input.parameters, 'healthCheck') ?
        'Only External Service create accepts this TCP/HTTP healthCheck: required integer port 1 through 65535, optional exact requestLine up to 1024 characters without CR, LF or NUL, and optional integer interval, responseTimeout, healthyThreshold and unhealthyThreshold. Omit requestLine or use an empty string for TCP. Timings are milliseconds and thresholds count checks. Omit the whole healthCheck for none; do not use null, Host, URL, headers, credentials, strategy, or send it through update_targets or update_metadata. Reuse the selected Stack parentRef and preserve all requested settings.' : serviceCreateInputRejected ?
        'Check the native PortSpec strings and healthCheck fields and bounds. The server rejected this input. If these fields are unsupported on this server version, use the matching typed-create adapter or the normal console. Do not drop requested settings, send launchConfig or retry through a generic update.' :
        result.field && /^parameters\.(ports|healthCheck)(\.|\[|$)/.test(result.field) ?
        'Service and Container create accept ports as at most 64 native PortSpec strings of 1 through 128 UTF-16 units. Container create verifies stopped configuration; start and live host bindings need a separate approved plan. Only Service create accepts healthCheck with required port 1 through 65535 and the exact schema fields and bounds. Timings are milliseconds; thresholds count checks. Service create requires the selected Stack parentRef unchanged; Container create has no parentRef.' :
        input && ['service', 'stack'].includes(input.resourceType) && Object.prototype.hasOwnProperty.call(SERVICE_UPGRADE_LIFECYCLE, input.operation) && result.field && result.field.startsWith('parameters') ?
        input.resourceType === 'stack' ? 'Use the selected Stack targetRef and empty parameters: {} for this native Stack upgrade lifecycle action. Do not send an image, count, checkpoint flag, state or raw action. A new Stack image or Catalog upgrade is a different workflow; do not substitute a Service upgrade. The exact plan still requires human confirmation.' : 'Use this selected Service targetRef and empty parameters for the existing upgrade lifecycle action. Do not send an image, strategy, state or raw action. A new image upgrade uses preview_service_upgrade and a separate human-approved plan; do not silently substitute it.' :
        input && ['archive', 'restore'].includes(input.operation) && result.field && result.field.startsWith('parameters') ?
        'Preview archive or restore separately with an existing targetRef and empty parameters. Do not include a service clone, archive flag or other settings.' : repairs[result.field] || (result.field && /^parameters\.(command|entryPoint)(\[\d+\])?$/.test(result.field) ?
        'Use a string array: at most 64 items, 4096 UTF-16 units per item, 16384 in total, and no NUL. These arrays are supported only for service/container create.' :
        'Use find_resources for the target family and reuse its resourceRef as targetRef. For service create, find the stack and pass its resourceRef as parentRef. Send only the fields supported by this operation.');
    }
    if ( !startAck ) { return result; }
    try {
      const event = {command: commandName, phase: 'result', status: result.status,
        reason: result.code || 'NONE', correlationId: startAck.requestId};
      if ( this.transportKind === 'stdio' && name === 'preview_resource_change' && input && input.resourceType === 'project' &&
        input.operation === 'update_metadata' && result.status === 'needs_user' && result.code === 'NEEDS_USER' &&
        result.reason === 'BRIDGE_PROJECT_BINDING_REQUIRED' && Array.isArray(startAck.supportedReasonDetails) &&
        startAck.supportedReasonDetails.includes('BRIDGE_PROJECT_BINDING_REQUIRED') ) {
        event.reasonDetail = 'BRIDGE_PROJECT_BINDING_REQUIRED';
      }
      await this.recordAudit(event, captured);
    } catch (error) {
      // Never submit audit under a replacement session, or convert a possible
      // write into a claimed rejection/success because its result ACK failed.
      try { this.context.assertCurrent(captured); } catch (contextError) {
        if ( descriptionMayHaveSaved ) { return this.unknownDescriptionOutcome(); }
        return APPLY_COMMANDS.includes(name) && businessStarted ? this.unknownOutcome(result.operationRef, captured) : publicError(contextError);
      }
      if ( name === 'update_service_description' ) {
        return descriptionMayHaveSaved ? this.unknownDescriptionOutcome() : publicError(new CommandError('UNAVAILABLE'));
      }
      return businessStarted ? this.unknownOutcome(result.operationRef, captured) : publicError(new CommandError('UNAVAILABLE'));
    }
    if ( operationNotice ) {
      let labelWarning;
      try { labelWarning = await observeOperation.call(this, operationNotice, {signal: options.signal, startedAt}); } catch (error) {
        // The operation and result ACK are already verified. Report only a
        // fixed label warning, never the private observer error or a failed write.
        labelWarning = 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING';
      }
      if ( ['BRIDGE_PROJECT_LABEL_REFRESH_PENDING', 'BRIDGE_PROJECT_LABEL_REFRESH_BLOCKED'].includes(labelWarning) ) {
        const pending = labelWarning === 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING';
        result.warnings = [{reason: labelWarning, retryable: pending, ...(pending ? {retryAfterMs: 1000} : {}),
          nextStep: pending ? 'The recorded operation result is unchanged, but its environment label could not be refreshed. Retry a read in this same environment later; do not reapply, create another plan, rebind the profile or change targets.' :
            'The recorded operation result is unchanged, but the current environment label is unavailable. Check the existing profile and permissions in the normal console. Do not reapply, broaden access, rebind the profile or change targets.'}];
      }
      try { this.context.assertCurrent(captured, options.signal); } catch (contextError) { return publicError(contextError); }
    }
    return result;
  }

  async recordAudit(event, captured) {
    this.context.assertCurrent(captured);
    let acknowledgement;
    try { acknowledgement = await this.audit(event, captured); } catch (error) {
      this.context.assertCurrent(captured);
      // Admission still fails closed. Preserve verified authentication/policy
      // failures so their repair does not suggest changing environments.
      const status = Number(error && (error.status || error.statusCode || (error.response && error.response.status)));
      if ( ['SESSION_REQUIRED', 'FORBIDDEN', 'CONTEXT_CHANGED', 'CONFLICT'].includes(publicError(error).code) &&
        (error instanceof CommandError || [401, 403].includes(status)) ) { throw error; }
      throw new CommandError('UNAVAILABLE');
    }
    this.context.assertCurrent(captured);
    if ( !acknowledgement || acknowledgement.accepted !== true || typeof acknowledgement.requestId !== 'string' || !acknowledgement.requestId ) {
      throw new CommandError('UNAVAILABLE');
    }
    return acknowledgement;
  }

  unknownOutcome(operationRef, captured) {
    const outcome = {status: 'unknown', code: 'UNKNOWN_RESULT', contractVersion: COMMAND_VERSION,
      nextStep: 'The operation may have been accepted. Query the existing plan using an authorized session; do not submit another change.'};
    if ( operationRef ) {
      try {
        this.context.assertCurrent(captured);
        this.context.resolve(operationRef, 'operation', captured);
        outcome.operationRef = operationRef;
        outcome.nextStep = 'Call get_operation with this operationRef. Do not submit another change.';
      } catch (contextError) { /* No old reference is published into the new context. */ }
    }
    return outcome;
  }

  unknownDescriptionOutcome() {
    return {status: 'unknown', code: 'UNKNOWN_RESULT', contractVersion: COMMAND_VERSION,
      nextStep: 'Find the service again and use get_service to inspect its description. Do not automatically retry the description update.'};
  }

  prefix(captured) { return `projects/${encodeURIComponent(captured.projectId)}`; }

  resourcePath(descriptor, captured) {
    return descriptor.scope === 'project' ? `${this.prefix(captured)}/${descriptor.collection}` : descriptor.collection;
  }

  async readResourcePath(path, captured, signal) {
    this.context.assertCurrent(captured, signal);
    let response;
    try { response = await this.request({url: path, method: 'GET', signal}); }
    catch (error) { this.context.assertCurrent(captured, signal); throw error; }
    this.context.assertCurrent(captured, signal);
    if ( !response || !response.body || typeof response.body !== 'object' ) { throw new CommandError('INVALID_RESPONSE'); }
    return response.body;
  }

  supportsResource(descriptor) { return descriptor.readTransport !== 'pending'; }
  usesResourceView(descriptor) { return descriptor.readTransport !== 'catalog' && (descriptor.readTransport === 'view' || this.transportKind === 'stdio'); }

  async readCapabilities(scope, captured, signal) {
    try {
      const path = scope === 'project' ? `${this.prefix(captured)}/schemas?limit=1000` : 'schemas?limit=1000';
      const body = await this.readResourcePath(path, captured, signal);
      if ( !Array.isArray(body.data) || body.data.length > 2000 ) { throw new CommandError('INVALID_RESPONSE'); }
      const schemas = new Map(body.data.filter((item) => item && typeof item.id === 'string').map((item) => [item.id.toLowerCase(), item]));
      return {schemas};
    } catch (error) {
      const failure = publicError(error);
      if ( failure.code === 'FORBIDDEN' ) { return {schemas: new Map(), unavailable: 'FORBIDDEN'}; }
      throw error;
    }
  }

  async list_capabilities(_input, captured, signal) {
    // Separate role-specific schema sources; the global schema never inherits
    // the selected project's permission and every actual read is reauthorized.
    const project = this.transportKind === 'stdio' ? {schemas: new Map()} : await this.readCapabilities('project', captured, signal);
    const global = this.transportKind === 'stdio' ? {schemas: new Map()} : await this.readCapabilities('global', captured, signal);
    return {status: 'succeeded', resourceTextIsUntrusted: true, families: RESOURCE_FAMILIES.map((entry) => ({
      family: entry.name, coverageStatus: entry.resources.some((item) => !this.supportsResource(item)) ? 'pending-adapter' : entry.coverageStatus,
      reason: safeText(entry.reason, 512), resources: entry.resources.map((descriptor) => {
        const source = descriptor.scope === 'project' ? project : global;
        const definition = source.schemas.get(descriptor.type.toLowerCase());
        const supported = this.supportsResource(descriptor), needsCheck = supported && (this.usesResourceView(descriptor) || descriptor.readTransport === 'catalog');
        return {resourceType: descriptor.type, scope: descriptor.scope, coverageStatus: supported && !descriptor.limitations.length ? 'implemented' : 'pending-adapter',
          metadataLimitations: [...descriptor.limitations],
          typedAuditQuery: descriptor.type === 'auditLog' ? {
            availability: 'implemented',
            transport: 'native-cookie-or-dedicated-api-key', authorization: 'requires-current-native-owner-and-key-read-scope',
            payloads: 'human-only-withheld', safeFields: [...AUDIT_FIELDS],
            input: 'find_resources.auditFilters', maximumPageRows: 50, maximumScanRows: 20000,
          } : null,
          canFind: needsCheck ? null : supported && !!definition && Array.isArray(definition.collectionMethods) && definition.collectionMethods.includes('GET'),
          canGet: needsCheck ? null : supported && !!definition && Array.isArray(definition.resourceMethods) && definition.resourceMethods.includes('GET'),
          authorization: needsCheck ? 'requires-server-check' : 'role-schema',
          safeFields: [...descriptor.fields], parentType: descriptor.parent ? descriptor.parent.type : null,
          parentRequired: !!(descriptor.parent && descriptor.parent.required),
          operations: RESOURCE_CHANGES[descriptor.type] ? Object.keys(RESOURCE_CHANGES[descriptor.type]) : [],
          ...(descriptor.type === 'service' ? {createFields: [...RESOURCE_CHANGES.service.create.fields], createFieldsServerCheckRequired: true} : {}),
          ...(descriptor.type === 'loadBalancerService' ? {createFields: [...RESOURCE_CHANGES.loadBalancerService.create.fields], createWorkflow: TCP_LOAD_BALANCER_CREATE, createFieldsServerCheckRequired: true} : {}),
          ...(descriptor.type === 'dnsService' ? {workflow: [...ALIAS_WORKFLOW], workflowNotice: ALIAS_CREATE_NEXT_STEP} : {}),
          changeModeEnabled: captured.mode === 'enabled', changesRequireHumanApproval: true,
          unavailableReason: needsCheck ? null : !supported ? 'PENDING_ADAPTER' : source.unavailable || (!definition ? 'NOT_VISIBLE' : null)};
      }),
    }))};
  }

  findDescriptor(input) {
    const entry = resourceFamily(input.family);
    if ( !entry ) { throw new CommandError('INVALID_INPUT', 'family'); }
    if ( !entry.resources.length ) { throw new CommandError('UNAVAILABLE', 'family'); }
    const descriptor = resourceDescriptor(input.family, input.resourceType);
    if ( !descriptor ) { throw new CommandError('INVALID_INPUT', 'resourceType'); }
    if ( !this.supportsResource(descriptor) ) { throw new CommandError('UNAVAILABLE', 'resourceType'); }
    return descriptor;
  }

  resourceIdentity(body, descriptor, captured) {
    return body && typeof body.id === 'string' && /^[a-zA-Z0-9_.:-]{1,256}$/.test(body.id) && !['.', '..'].includes(body.id) &&
      (descriptor.scope !== 'project' || !body.accountId || body.accountId === captured.projectId);
  }

  resourceNext(value, descriptor, captured, parent) {
    if ( !value ) { return null; }
    if ( typeof value !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
    const path = this.resourcePath(descriptor, captured);
    const base = new URL(`${this.apiEndpoint.replace(/\/$/, '')}/${path}`, this.origin);
    const next = new URL(value, base);
    const keys = [...next.searchParams.keys()];
    if ( next.origin !== base.origin || next.pathname !== base.pathname || next.username || next.password || next.hash ||
      keys.some((key) => !['limit', 'marker', parent && descriptor.parent.field].includes(key)) ||
      keys.some((key) => next.searchParams.getAll(key).length !== 1) ||
      next.searchParams.has('limit') && (!/^\d+$/.test(next.searchParams.get('limit')) || Number(next.searchParams.get('limit')) > MAX_PAGE_SIZE) ||
      parent && next.searchParams.get(descriptor.parent.field) !== parent.id ) { throw new CommandError('INVALID_RESPONSE'); }
    return `${path}${next.search}`;
  }

  stackParentProjection(body, descriptor, captured) {
    if ( !descriptor.parent || descriptor.parent.type !== 'stack' ) { return null; }
    // Typed resource views only include Stack names after the native parent
    // owner and current Key authorize them. Never recover a name from a path.
    const id = body[descriptor.parent.field], name = safeText(body.stackName);
    const hasParentId = typeof id === 'string' && id;
    const resolved = hasParentId && name &&
      (body.parentResolution === undefined || body.parentResolution === 'resolved');
    // Retain list's opaque relationship ref even when its name is unavailable;
    // resolving that ref still performs a fresh authorized Stack read.
    return {parentRef: hasParentId ? this.referenceResource({id, family: 'stack', resourceType: 'stack', scope: descriptor.scope}, captured) : null,
      parentResolution: resolved ? 'resolved' : 'unavailable', stackName: resolved ? name : null};
  }

  async find_resources(input, captured, signal) {
    if (input.auditFilters !== undefined) {
      if (input.family !== 'audit' || input.resourceType !== undefined && input.resourceType !== 'auditLog' ||
        input.query !== undefined || input.parentRef !== undefined) { throw new CommandError('INVALID_INPUT', 'auditFilters'); }
      return this.findAuditResources(input, captured, signal);
    }
    const descriptor = this.findDescriptor(input);
    const useCatalog = descriptor.readTransport === 'catalog';
    const catalogVersion = descriptor.type === 'catalogTemplateVersion';
    if ( catalogVersion && input.query !== undefined ) { throw new CommandError('INVALID_INPUT', 'query'); }
    let parent;
    if ( input.parentRef ) {
      parent = this.resolveResourceReference(input.parentRef, descriptor.parent && descriptor.parent.type, captured, 'parentRef');
      if ( !descriptor.parent || parent.resourceType !== descriptor.parent.type || parent.scope !== descriptor.scope ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
    }
    if ( descriptor.parent && descriptor.parent.required && !parent ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
    let path = useCatalog ? null : `${this.resourcePath(descriptor, captured)}?limit=${MAX_PAGE_SIZE}`, marker;
    if ( parent && !useCatalog ) { path += `&${descriptor.parent.field}=${encodeURIComponent(parent.id)}`; }
    if ( input.cursor ) {
      const cursor = this.context.resolve(input.cursor, 'resourceCursor', captured);
      if (cursor.auditQuery) { throw new CommandError('INVALID_INPUT', 'auditFilters'); }
      if ( cursor.family !== input.family || cursor.resourceType !== descriptor.type || cursor.query !== (input.query || '') || cursor.parentRef !== (input.parentRef || '') ) {
        throw new CommandError('INVALID_INPUT', 'cursor');
      }
      path = cursor.path; marker = cursor.marker;
    }
    const useView = this.usesResourceView(descriptor);
    const body = catalogVersion ? await this.catalogReader.findVersions({templateId: parent.id, marker}, captured, signal) :
      useCatalog ? await this.catalogReader.find({query: input.query, marker}, captured, signal) :
      useView ? await this.resourceView(descriptor, captured, {query: input.query, marker, parentId: parent && parent.id}, signal) :
      await this.readResourcePath(path, captured, signal);
    if ( !Array.isArray(body.data) || body.data.length > MAX_PAGE_SIZE ) { throw new CommandError('INVALID_RESPONSE'); }
    const typedPage = useView || useCatalog;
    const next = typedPage ? body.nextMarker : this.resourceNext(body.pagination && body.pagination.next, descriptor, captured, parent);
    const nextCursor = next ? this.context.reference('resourceCursor', {family: input.family, resourceType: descriptor.type,
      query: input.query || '', parentRef: input.parentRef || '', path: typedPage ? null : next,
      marker: typedPage ? next : null}, captured) : null;
    const items = body.data.filter((item) => this.resourceIdentity(item, descriptor, captured) && this.matches(item, input.query, descriptor) &&
      (!parent || item[descriptor.parent.field] === parent.id)).map((item) => {
      const stackParent = this.stackParentProjection(item, descriptor, captured);
      const displayPath = descriptor.type === 'registry' ? `${safeText(captured.projectName)}/registry/${safeRegistryAddress(item.serverAddress) || '(unknown)'}` :
        descriptor.type === 'processInstance' ? `(global)/processes/${safeResourceFields(item, descriptor).name || 'unknown'}` : useCatalog ? this.catalogDisplayPath(item, captured, parent) :
        (!stackParent && safeText(item.displayPath, 768)) || `${descriptor.scope === 'project' ? safeText(captured.projectName) : '(global)'}/${stackParent ? stackParent.stackName || '(parent unavailable)' : input.family}/${safeText(item.name) || descriptor.type}`;
      const target = {id: item.id, family: input.family, resourceType: descriptor.type, scope: descriptor.scope};
      if ( ['container', 'port', 'instanceLink'].includes(descriptor.type) && typeof item.uuid === 'string' && item.uuid && item.uuid.length <= 128 ) { target.nativeUuid = item.uuid; }
      if ( useCatalog ) {
        target.catalogPath = displayPath;
        target.catalogIdentity = catalogVersion ? {...parent.catalogIdentity, version: item.version, revision: item.revision} :
          {templateKey: item.templateKey, catalogScope: item.catalogScope, catalogId: item.catalogId};
      }
      if ( catalogVersion || ['port', 'instanceLink'].includes(descriptor.type) ) { target.parentId = parent.id; target.parentRef = input.parentRef; }
      if ( ['port', 'instanceLink'].includes(descriptor.type) ) {
        if ( !target.nativeUuid || !parent.nativeUuid ) { throw new CommandError('STALE_REFERENCE', 'parentRef'); }
        target.sourceUuid = parent.nativeUuid;
      }
      const resourceRef = this.referenceResource(target, captured);
      const parentRef = catalogVersion || ['port', 'instanceLink'].includes(descriptor.type) ? input.parentRef : stackParent ? stackParent.parentRef : null;
      return {resourceRef, resourceType: descriptor.type, scope: descriptor.scope,
        parentRef, parentResolution: catalogVersion ? 'resolved' : stackParent ? stackParent.parentResolution : null,
        displayPath,
        fields: safeResourceFields(item, descriptor), truncatedFields: this.resourceTruncation(item, descriptor)};
    });
    const result = {status: 'succeeded', resourceTextIsUntrusted: true, family: input.family, resourceType: descriptor.type, scope: descriptor.scope,
      items, nextCursor, complete: !nextCursor};
    if ( items.some((item) => item.parentResolution === 'unavailable') ) {
      result.nextStep = 'Some parent names are unavailable. Find the visible stack by name and pass its resourceRef as parentRef to narrow this search. Do not choose a duplicate automatically.';
    }
    if ( useCatalog ) {
      result.nextStep = catalogVersion ?
        'Select the exact requested version resourceRef and use get_resource to read its safe launch questions. Version bounds and upgradeFrom are metadata, not a verified compatibility decision. Never automatically choose a version or guess defaults.' :
        'If several templates match, ask which catalog scope and templateKey the user means. Then list catalogTemplateVersion with that template resourceRef as parentRef and no query. Do not automatically choose defaultVersion.';
    }
    return result;
  }

  async get_resource(input, captured, signal) {
    if ( /^(stack|service)_/.test(input.resourceRef) ) { throw new CommandError('INVALID_INPUT', 'resourceRef'); }
    const target = this.context.resolve(input.resourceRef, 'resource', captured);
    if ( input.view !== undefined && !(input.view === 'stack_graph' && target.resourceType === 'stack' && target.scope === 'project' ||
      input.view === 'container_logs' && target.resourceType === 'container' && target.scope === 'project') ) {
      throw new CommandError('INVALID_INPUT', 'view');
    }
    if (input.tailLines !== undefined && input.view !== 'container_logs') { throw new CommandError('INVALID_INPUT', 'tailLines'); }
    if (input.view === 'container_logs') {
      const descriptor = this.findDescriptor({family: target.family, resourceType: target.resourceType});
      const view = await this.resourceView(descriptor, captured, {resourceId: target.id, view: 'container_logs', tailLines: input.tailLines}, signal);
      this.context.assertCurrent(captured, signal);
      return boundedContainerLogs(view, target, input.resourceRef, captured);
    }
    if (target.auditQuery) {
      if (target.family !== 'audit' || target.resourceType !== 'auditLog') { throw new CommandError('INVALID_INPUT', 'resourceRef'); }
      const row = await this.auditReader.get(target, captured, signal);
      return {status: 'succeeded', resourceTextIsUntrusted: true, resourceRef: input.resourceRef,
        resourceType: 'auditLog', scope: 'global', fields: auditSafeFields(row),
        payloadPolicy: 'HUMAN_ONLY_NATIVE_AUDIT_UI', nextStep: 'Only authorized audit metadata is included. Full request/response objects remain in native human audit detail. ALLOW, HTTP success or a client-reported outcome is not verified operation completion; use the original get_operation receipt.'};
    }
    const descriptor = this.findDescriptor({family: target.family, resourceType: target.resourceType});
    let body;
    if ( input.view === 'stack_graph' || this.usesResourceView(descriptor) || descriptor.readTransport === 'catalog' || ['volume', 'host'].includes(descriptor.type) ) {
      const view = descriptor.type === 'catalogTemplateVersion' ? await this.catalogReader.getVersion({templateId: target.parentId, versionId: target.id}, captured, signal) :
        descriptor.readTransport === 'catalog' ? await this.catalogReader.get({id: target.id}, captured, signal) :
          await this.resourceView(descriptor, captured, {resourceId: target.id, view: input.view}, signal);
      if ( view.data.length !== 1 ) { throw new CommandError('INVALID_RESPONSE'); }
      body = view.data[0];
    } else { body = await this.readResourcePath(`${this.resourcePath(descriptor, captured)}/${encodeURIComponent(target.id)}`, captured, signal); }
    if ( !this.resourceIdentity(body, descriptor, captured) || body.id !== target.id ) { throw new CommandError('INVALID_RESPONSE'); }
    const result = {status: 'succeeded', resourceTextIsUntrusted: true, resourceRef: input.resourceRef, family: target.family,
      resourceType: descriptor.type, scope: descriptor.scope, fields: safeResourceFields(body, descriptor), truncatedFields: this.resourceTruncation(body, descriptor)};
    if ( input.view === 'stack_graph' ) {
      result.graph = this.stackGraphProjection(body.stackGraph, captured);
      result.nextStep = 'This opt-in graph contains only bounded, currently authorized ordinary Service links and authorized parents. Follow each node resourceRef with get_resource for current details; compare all same-name refs. Completeness and permission completeness are unknown, including when empty or below the limits. Other Service kinds, arbitrary link strings and hidden relationships are not represented. Never infer that a Stack is empty or safe to stop, remove or change from this graph.';
    }
    if ( ['apiKey', 'apiKeyRestricted'].includes(descriptor.type) ) {
      try {
        result.policyRead = configuredPolicyRead(body.apiKeyPolicyRead || {availability: 'unavailable',
          representation: 'configured-policy-read-only', previewComplete: false, reason: 'POLICY_FIELDS_UNAVAILABLE',
          effectiveAuthorization: 'not-evaluated'}, target => {
          const family = RESOURCE_FAMILIES.find(item => item.resources.some(resource => resource.type === target.type));
          const typed = family && resourceDescriptor(family.name, target.type);
          if ( !typed || !this.resourceIdentity(target, typed, captured) ||
            typed.scope === 'project' && target.accountId !== captured.projectId ) { return null; }
          const resourceRef = this.referenceResource({id: target.id, family: family.name, resourceType: typed.type,
            scope: typed.scope, name: safeText(target.name)}, captured);
          const projected = {resourceRef, resourceType: typed.type, name: safeText(target.name) || `(${typed.type})`};
          const parent = this.stackParentProjection(target, typed, captured);
          if ( parent ) { projected.parentRef = parent.parentRef; projected.parentResolution = parent.parentResolution; }
          return projected;
        });
      } catch (_invalid) { throw new CommandError('INVALID_RESPONSE'); }
      result.nextStep = 'This is a read-only configured-policy snapshot, not current Key usability or an effective authorization matrix. Credential state, expiry, owner ceilings and fresh native authorization still apply. Missing scope previews stay unavailable; policy changes remain in the normal Key UI.';
    }
    const stackParent = this.stackParentProjection(body, descriptor, captured);
    if ( stackParent ) {
      result.parentRef = stackParent.parentRef; result.parentResolution = stackParent.parentResolution;
    }
    if ( descriptor.type === 'processInstance' ) {
      result.payloadPolicy = 'HUMAN_ONLY_NATIVE_PROCESS_ERROR_UI';
      result.nextStep = 'These are bounded, authorized process diagnostic facts, not a verified business-operation result. Diagnostic completeness remains unknown, including for empty logs or missing fields. Use the normal process UI for raw exceptions; do not guess causes, replay, retry, or change resources.';
    }
    if ( descriptor.type === 'volume' ) {
      result.usageReferences = this.volumeUsageReferences(body, captured);
      result.nextStep = 'Usage completeness is unknown. Only listed containers were authorized in this context; no hidden names, IDs or counts are available. Empty results do not mean unused or safe to delete. Mount paths are container destinations, not host filesystem paths. Use the exact containerRef and readable Stack name to disambiguate, or inspect the normal console; retain the native removal checks.';
    }
    if ( descriptor.type === 'host' ) {
      result.workloadReferences = this.hostWorkloadReferences(body, captured);
      result.nextStep = 'Workload completeness is unknown. Only listed containers were freshly authorized on this Host; hidden names, IDs and counts are excluded. Empty results do not mean an empty Host or safe evacuation, deactivation or removal. Use the exact containerRef and readable Stack name to disambiguate; Host start/stop require a separately human-approved native activate/deactivate plan, never inferred permission from these workload rows. Evacuation, Host removal and daemon/agent actions are unsupported here.';
    }
    if ( descriptor.type === 'dnsService' ) {
      const {linkedServiceCount, unresolvedTargetCount, targetServices} = body;
      if ( linkedServiceCount === undefined && unresolvedTargetCount === undefined && targetServices === undefined ) {
        result.targetBindings = {availability: 'unavailable'};
        result.nextStep = 'Only Alias metadata is available; target bindings have not been resolved. Do not report the Alias workflow as configured. Read its targets in the normal console.';
      } else {
        const names = safeAliasTargetSummary(targetServices);
        if ( !names || !Number.isSafeInteger(linkedServiceCount) || linkedServiceCount < 0 || !Number.isSafeInteger(unresolvedTargetCount) ||
          unresolvedTargetCount < 0 || names.length + unresolvedTargetCount !== linkedServiceCount ) { throw new CommandError('INVALID_RESPONSE'); }
        result.targetBindings = {availability: unresolvedTargetCount ? 'partial' : 'resolved', linkedServiceCount, unresolvedTargetCount};
        result.nextStep = unresolvedTargetCount ?
          'Some Alias targets could not be resolved under the current authority or the simple-link adapter. No hidden target names or IDs are available. Use the normal console; do not guess a target or claim the bindings are complete.' : linkedServiceCount === 0 ?
            'This Alias has no targets. To configure it, find each requested service by exact name and Stack, then preview update_targets with its serviceRefs for a separate human approval. Start is optional and separate.' :
            'Review the complete target names and Stack paths. To change them, find exact serviceRefs and preview update_targets for another human approval; an empty serviceRefs array explicitly clears the simple targets.';
      }
    }
    if ( descriptor.readTransport === 'catalog' ) {
      if ( descriptor.type === 'catalogTemplate' ) { target.catalogPath = this.catalogDisplayPath(body, captured); }
      result.displayPath = target.catalogPath;
    }
    if ( descriptor.type === 'catalogTemplateVersion' ) {
      result.parentRef = target.parentRef;
      result.nextStep = 'Keep this exact version resourceRef as the selected metadata version. Compatibility has not been verified; use the normal console for template launch and configuration.';
      try {
        result.launchOptions = await this.catalogLaunch.options(target, captured, signal);
        result.nextStep = result.launchOptions.launchEnabled ?
          'Compatibility has not been verified. Catalog launch reads the created resources, configures service links and may start services, so the target scope requires read, create and update permission. External volume references (external=true) are not supported by this adapter. Use these questionRefs only with this catalogVersionRef. Preview stack create_from_catalog with the requested name and typed answers. Human-only inputs must be completed in the console; never guess defaults or secret values.' :
          'Keep this exact version resourceRef as selected metadata. Compatibility has not been verified. Tool-based Catalog launch is disabled; use the normal console or ask the administrator about the existing feature setting.';
      } catch (error) {
        this.context.assertCurrent(captured, signal);
        const failure = publicError(error);
        result.launchOptions = {availability: 'unavailable', authorization: 'requires-server-check', code: failure.code, nextStep: failure.nextStep};
      }
    }
    if ( stackParent ) {
      const nextStep = stackParent.parentResolution === 'resolved' ?
        'Use get_resource with this parentRef to read the current authorized Stack name before selecting a same-name resource. Do not infer the parent from labels or choose a duplicate automatically.' :
        'The parent Stack is unavailable under current permissions. No parent name or ID is included. Use the normal console or an authorized visible Stack; do not guess the parent.';
      result.nextStep = result.nextStep ? `${nextStep} ${result.nextStep}` : nextStep;
    }
    return result;
  }

  catalogDisplayPath(item, captured, parent) {
    if ( item.type === 'catalogTemplateVersion' ) {
      return `${safeText(parent.catalogPath, 768)}/${safeText(item.version)}${item.revision === null ? '' : ` (revision ${item.revision})`}`.slice(0, 1024);
    }
    // Keep the complete logical key even when shared catalog/display labels
    // are long. Full labels remain available in the safe metadata fields.
    return [safeText(captured.projectName, 64), safeText(item.catalogScope, 8), safeText(item.catalogId, 64),
      safeText(item.templateKey, 512), safeText(item.name, 64)].filter(Boolean).join('/');
  }

  resourceTruncation(body, descriptor) {
    const fields = truncatedResourceFields(body, descriptor);
    // The Catalog reader bounds strings before projection. Preserve its safe
    // truncation warning so an append never mistakes a prefix for full text.
    if ( descriptor.readTransport === 'catalog' && body.truncatedFields ) { fields.push(...body.truncatedFields); }
    return [...new Set(fields)].sort();
  }

  async findAuditResources(input, captured, signal) {
    const cursor = input.cursor ? this.context.resolve(input.cursor, 'resourceCursor', captured) : null;
    if (cursor && (cursor.family !== 'audit' || cursor.resourceType !== 'auditLog' || !cursor.auditQuery)) {
      throw new CommandError('INVALID_INPUT', 'cursor');
    }
    const page = await this.auditReader.find(input.auditFilters, cursor, captured, signal);
    const items = page.rows.map(row => ({
      resourceRef: this.context.reference('resource', {id: row.id, family: 'audit', resourceType: 'auditLog',
        scope: 'global', auditQuery: {...page.query}}, captured),
      resourceType: 'auditLog', scope: 'global', parentRef: null, parentResolution: null,
      displayPath: 'audit/' + safeText(row.created, 64) + '/' + safeText(row.eventType, 160),
      fields: auditSafeFields(row), truncatedFields: [],
    }));
    const nextCursor = page.nextOffset === null ? null : this.context.reference('resourceCursor', {
      family: 'audit', resourceType: 'auditLog', auditQuery: {...page.query}, offset: page.nextOffset,
      auditFilterSignature: page.signature,
    }, captured);
    return {status: 'succeeded', resourceTextIsUntrusted: true, family: 'audit', resourceType: 'auditLog',
      scope: 'global', items, nextCursor, complete: !nextCursor, total: page.total, range: page.range,
      payloadPolicy: 'HUMAN_ONLY_NATIVE_AUDIT_UI', workflowCoverage: 'authorized-metadata-query',
      nextStep: 'Use get_resource for safe event detail, or nextCursor with unchanged auditFilters. Each query requires current audit read scope, visible environments, and target Key metadata read when filtering a Key. Payloads remain human-only in native audit UI. Server query completion is distinct from the resource operation outcome; use the original operation receipt.'};
  }

  referenceResource(target, captured) {
    this.context.assertCurrent(captured);
    if ( this._resourceReferenceEpoch !== captured.epoch ) { this._resourceReferences = new Map(); this._resourceReferenceEpoch = captured.epoch; }
    const key = JSON.stringify([target.scope, target.resourceType, target.id]);
    if ( !this._resourceReferences.has(key) ) { this._resourceReferences.set(key, this.context.reference('resource', target, captured)); }
    return this._resourceReferences.get(key);
  }

  resolveResourceReference(reference, expectedType, captured, field) {
    try { return this.context.resolve(reference, 'resource', captured); }
    catch (error) {
      if ( error.code !== 'STALE_REFERENCE' ) { throw error; }
      if ( ['stack', 'service'].includes(expectedType) ) {
        try {
          const target = this.context.resolve(reference, expectedType, captured);
          return Object.assign({}, target, {resourceType: expectedType, scope: 'project'});
        } catch (legacyError) { if ( legacyError.code !== 'STALE_REFERENCE' ) { throw legacyError; } }
      }
      throw new CommandError('STALE_REFERENCE', field);
    }
  }

  ordinaryServiceReference(reference, captured, field) {
    let target;
    try { target = this.context.resolve(reference, 'resource', captured); }
    catch (error) {
      if ( error.code !== 'STALE_REFERENCE' ) { throw error; }
      throw new CommandError('STALE_REFERENCE', field);
    }
    if ( target.family !== 'service' || target.resourceType !== 'service' || target.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', field); }
    return target;
  }

  volumeUsageReferences(body, captured) {
    const rows = body.usageReferences;
    if ( rows === undefined && body.usageReferencesStatus === undefined ) { return {availability: 'unknown', limit: 50, items: []}; }
    if ( body.usageReferencesStatus !== 'unknown' || !Array.isArray(rows) || rows.length > 50 ) { throw new CommandError('INVALID_RESPONSE'); }
    const fields = ['containerId', 'name', 'state', 'mountPath', 'readOnly', 'stackResolution', 'stackName'];
    const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
    // Validate the whole projection before minting any same-context reference.
    for ( const row of rows ) {
      if ( !row || Object.keys(row).some((key) => !fields.includes(key)) || !text(row.containerId, 256) ||
        !/^[a-zA-Z0-9_.:-]+$/.test(row.containerId) || ['.', '..'].includes(row.containerId) ||
        !text(row.name, 512) || !text(row.state, 512) || !text(row.mountPath, 1024) || !row.mountPath.startsWith('/') ||
        typeof row.readOnly !== 'boolean' || !['unknown', 'resolved'].includes(row.stackResolution) ||
        (row.stackResolution === 'resolved' ? !text(row.stackName, 512) : row.stackName !== undefined) ) { throw new CommandError('INVALID_RESPONSE'); }
    }
    return {availability: 'unknown', limit: 50, items: rows.map((row) => ({
      containerRef: this.referenceResource({id: row.containerId, family: 'container', resourceType: 'container', scope: 'project'}, captured),
      name: row.name, state: row.state, mountPath: row.mountPath, readOnly: row.readOnly,
      stackResolution: row.stackResolution, ...(row.stackResolution === 'resolved' ? {stackName: row.stackName} : {}),
    }))};
  }

  hostWorkloadReferences(body, captured) {
    const rows = body.workloadReferences;
    if ( rows === undefined && body.workloadReferencesStatus === undefined ) { return {availability: 'unknown', limit: 50, items: []}; }
    if ( body.workloadReferencesStatus !== 'unknown' || !Array.isArray(rows) || rows.length > 50 ) { throw new CommandError('INVALID_RESPONSE'); }
    const fields = ['containerId', 'name', 'state', 'stackResolution', 'stackName'], seen = new Set();
    const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
    for ( const row of rows ) {
      if ( !row || Object.keys(row).some((key) => !fields.includes(key)) || !text(row.containerId, 256) ||
        !/^[a-zA-Z0-9_.:-]+$/.test(row.containerId) || ['.', '..'].includes(row.containerId) || seen.has(row.containerId) ||
        !text(row.name, 512) || !text(row.state, 512) || !['unknown', 'resolved'].includes(row.stackResolution) ||
        (row.stackResolution === 'resolved' ? !text(row.stackName, 512) : row.stackName !== undefined) ) { throw new CommandError('INVALID_RESPONSE'); }
      seen.add(row.containerId);
    }
    return {availability: 'unknown', limit: 50, items: rows.map((row) => ({
      containerRef: this.referenceResource({id: row.containerId, family: 'container', resourceType: 'container', scope: 'project'}, captured),
      name: row.name, state: row.state, stackResolution: row.stackResolution,
      ...(row.stackResolution === 'resolved' ? {stackName: row.stackName} : {}),
    }))};
  }

  stackGraphProjection(graph, captured) {
    const keys = ['subset', 'completeness', 'permissionCompleteness', 'nodeLimit', 'edgeLimit', 'limitReached', 'nodes', 'edges'];
    if ( !graph || typeof graph !== 'object' || Array.isArray(graph) || Object.keys(graph).length !== keys.length ||
      Object.keys(graph).some(key => !keys.includes(key)) || graph.subset !== 'ordinary-service-links' || graph.completeness !== 'unknown' ||
      graph.permissionCompleteness !== 'unknown' || graph.nodeLimit !== 32 || graph.edgeLimit !== 32 || typeof graph.limitReached !== 'boolean' ||
      !Array.isArray(graph.nodes) || graph.nodes.length > 32 || !Array.isArray(graph.edges) || graph.edges.length > 32 ||
      graph.limitReached !== (graph.nodes.length === 32 || graph.edges.length === 32) ) { throw new CommandError('INVALID_RESPONSE'); }
    const nodes = new Map(), projected = [];
    const text = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\x00-\x1f\x7f]/.test(value);
    for ( const node of graph.nodes ) {
      if ( !node || Object.keys(node).sort().join(',') !== 'accountId,id,name,nameTruncated,state,type' ||
        !text(node.id, 128) || !/^[A-Za-z0-9_.:-]+$/.test(node.id) || ['.', '..'].includes(node.id) || nodes.has(node.id) ||
        node.type !== 'service' || node.accountId !== captured.projectId || !text(node.name, 256) || !text(node.state, 64) ||
        typeof node.nameTruncated !== 'boolean' ) { throw new CommandError('INVALID_RESPONSE'); }
      const resourceRef = this.referenceResource({id: node.id, family: 'service', resourceType: 'service', scope: 'project'}, captured);
      nodes.set(node.id, resourceRef);
      projected.push({resourceRef, resourceType: 'service', name: node.name, nameTruncated: node.nameTruncated, state: node.state});
    }
    const seen = new Set(), edges = graph.edges.map(edge => {
      if ( !edge || Object.keys(edge).sort().join(',') !== 'relationship,sourceId,targetId' || edge.relationship !== 'service-link' ||
        !nodes.has(edge.sourceId) || !nodes.has(edge.targetId) || seen.has(JSON.stringify([edge.sourceId, edge.targetId])) ) { throw new CommandError('INVALID_RESPONSE'); }
      seen.add(JSON.stringify([edge.sourceId, edge.targetId]));
      return {sourceRef: nodes.get(edge.sourceId), targetRef: nodes.get(edge.targetId), relationship: 'service-link'};
    });
    return {subset: graph.subset, completeness: 'unknown', permissionCompleteness: 'unknown', nodeLimit: 32, edgeLimit: 32,
      limitReached: graph.limitReached, nodes: projected, edges};
  }

  async resourceView(descriptor, captured, options, signal) {
    const data = {resourceType: descriptor.type};
    for ( const field of ['resourceId', 'query', 'marker', 'parentId', 'view', 'tailLines'] ) {
      if ( options[field] !== undefined ) { data[field] = options[field]; }
    }
    const body = await this.call(captured, 'aiResourceViews', 'POST', data, signal);
    if ( body.resourceType !== descriptor.type || !Array.isArray(body.data) || body.data.length > MAX_PAGE_SIZE ||
      body.nextMarker !== undefined && body.nextMarker !== null && (typeof body.nextMarker !== 'string' || body.nextMarker.length > 128) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    return body;
  }

  async call(captured, path, method = 'GET', data, signal) {
    this.context.assertCurrent(captured, signal);
    let result;
    try {
      result = await this.request({url: `${this.prefix(captured)}/${path}`, method, data, signal});
    } catch (error) {
      // An old request must not report into a newer account or environment.
      this.context.assertCurrent(captured, signal);
      throw error;
    }
    this.context.assertCurrent(captured, signal);
    if ( !result || !result.body || typeof result.body !== 'object' ) { throw new CommandError('INVALID_RESPONSE'); }
    return result.body;
  }

  safeNext(value, collection, captured) {
    if ( !value ) { return null; }
    if ( typeof value !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
    const base = new URL(`${this.apiEndpoint.replace(/\/$/, '')}/${this.prefix(captured)}/${collection}`, this.origin);
    const next = new URL(value, base);
    if ( next.origin !== base.origin || next.pathname !== base.pathname || next.username || next.password || next.hash ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    return `${collection}${next.search}`;
  }

  async page(collection, input, captured, signal, extra = '') {
    let path = `${collection}?limit=${MAX_PAGE_SIZE}${extra}`;
    if ( input.cursor ) {
      const cursor = this.context.resolve(input.cursor, 'cursor', captured);
      if ( cursor.collection !== collection || cursor.query !== (input.query || '') || cursor.stackRef !== (input.stackRef || '') ) {
        throw new CommandError('INVALID_INPUT', 'cursor');
      }
      path = cursor.path;
    }
    const body = await this.call(captured, path, 'GET', undefined, signal);
    if ( !Array.isArray(body.data) || body.data.length > 10000 ) { throw new CommandError('INVALID_RESPONSE'); }
    const next = this.safeNext(body.pagination && body.pagination.next, collection, captured);
    const nextCursor = next ? this.context.reference('cursor', {collection, query: input.query || '', stackRef: input.stackRef || '', path: next}, captured) : null;
    return {items: body.data.filter((item) => projectResource(item, captured.projectId)), nextCursor};
  }

  matches(item, query, descriptor) {
    return !query || safeText(item.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) || descriptor && descriptor.type === 'registry' &&
      safeText(safeRegistryAddress(item.serverAddress)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }

  async find_stacks(input, captured, signal) {
    const page = await this.page('stacks', input, captured, signal);
    return {status: 'succeeded', resourceTextIsUntrusted: true, items: page.items.filter((item) => this.matches(item, input.query)).map((item) => ({
      stackRef: this.context.reference('stack', {id: item.id, name: safeText(item.name)}, captured),
      name: safeText(item.name), displayPath: `${safeText(captured.projectName)}/${safeText(item.name)}`,
    })), nextCursor: page.nextCursor, complete: !page.nextCursor};
  }

  async find_services(input, captured, signal) {
    const stack = input.stackRef ? this.context.resolve(input.stackRef, 'stack', captured) : null;
    const page = await this.page('services', input, captured, signal, stack ? `&stackId=${encodeURIComponent(stack.id)}` : '');
    const matches = page.items.filter((item) => this.matches(item, input.query) && (!stack || item.stackId === stack.id));
    // Resolve names through the same actor's scoped collection, never the global store cache.
    const stacks = matches.length ? await this.call(captured, 'stacks?limit=1000', 'GET', undefined, signal) : {data: []};
    if ( !Array.isArray(stacks.data) ) { throw new CommandError('INVALID_RESPONSE'); }
    const names = new Map(stacks.data.filter((item) => projectResource(item, captured.projectId)).map((item) => [item.id, safeText(item.name)]));
    return {status: 'succeeded', resourceTextIsUntrusted: true, items: matches.map((item) => {
      const stackName = names.get(item.stackId) || (stack && stack.name) || '';
      const descriptionLoaded = typeof item.description === 'string' || item.description === null;
      return {serviceRef: this.context.reference('service', {id: item.id, descriptionLoaded,
        description: descriptionLoaded ? item.description : undefined}, captured), name: safeText(item.name), stackName,
        displayPath: `${safeText(captured.projectName)}/${stackName || '(unavailable)'}/${safeText(item.name)}`};
    }), nextCursor: page.nextCursor, complete: !page.nextCursor};
  }

  async readService(serviceRef, captured, signal) {
    const target = this.context.resolve(serviceRef, 'service', captured);
    const body = await this.call(captured, `services/${encodeURIComponent(target.id)}`, 'GET', undefined, signal);
    if ( !projectResource(body, captured.projectId) || body.id !== target.id ) { throw new CommandError('INVALID_RESPONSE'); }
    return body;
  }

  async get_service(input, captured, signal) {
    const body = await this.readService(input.serviceRef, captured, signal);
    const reference = this.context.resolve(input.serviceRef, 'service', captured);
    const description = this.descriptionValue(body);
    if ( reference.descriptionLoaded && reference.description !== description ) { throw new CommandError('CONFLICT', 'serviceRef'); }
    reference.description = description;
    reference.descriptionLoaded = true;
    const launch = body.launchConfig || {};
    // Explicit allowlist: environment variables, labels, registry secrets and URLs are never returned.
    return {status: 'succeeded', resourceTextIsUntrusted: true, target: {serviceRef: input.serviceRef, name: safeText(body.name)},
      currentImage: imageName(launch.imageUuid), state: safeText(body.state, 64), description,
      summary: {scale: Number.isFinite(body.scale) ? body.scale : null, memoryMiB: Number.isFinite(launch.memory) ? Math.round(launch.memory / 1048576) : null},
      availableActions: {previewUpgrade: captured.mode === 'enabled' && !!((body.actionLinks && body.actionLinks.upgrade) || (body.actions && body.actions.upgrade))}};
  }

  descriptionValue(body) {
    // Detailed API resources omit null fields. Collection omissions remain
    // unknown until an explicit get_service loads this authoritative detail.
    const value = body.description === undefined ? null : body.description;
    if ( value !== null && (typeof value !== 'string' || value.length > 1024) ) { throw new CommandError('INVALID_RESPONSE'); }
    return value;
  }

  async update_service_description(input, captured, signal) {
    const reference = this.context.resolve(input.serviceRef, 'service', captured);
    if ( !reference.descriptionLoaded ) { throw new CommandError('STALE_REFERENCE', 'serviceRef'); }
    const expectedDescription = reference.description;
    const before = await this.readService(input.serviceRef, captured, signal);
    if ( this.descriptionValue(before) !== expectedDescription ) { throw new CommandError('CONFLICT', 'serviceRef'); }
    let responded = false;
    try {
      const result = await this.call(captured, 'aiServiceDescriptionUpdates', 'POST', {
        serviceId: reference.id, description: input.description, expectedDescription,
      }, signal);
      responded = true;
      if ( result.serviceId !== reference.id || result.description !== input.description ||
        result.status !== 'succeeded' || result.verifiedResult !== true ) { throw new CommandError('INVALID_RESPONSE'); }
      const after = await this.readService(input.serviceRef, captured, signal);
      if ( this.descriptionValue(after) !== input.description ) { throw new CommandError('INVALID_RESPONSE'); }
      // Update only after the persisted value was read back in this context.
      reference.description = input.description;
      reference.descriptionLoaded = true;
      return {status: 'succeeded', saved: true, verifiedResult: true, resourceTextIsUntrusted: true,
        target: {serviceRef: input.serviceRef, name: safeText(after.name)}, description: input.description};
    } catch (error) {
      if ( responded || publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ) { throw new UnknownDescriptionUpdate(); }
      throw error;
    }
  }

  planSummary(plan, planRef) {
    if ( plan && typeof plan.id === 'string' && plan.id.startsWith('aicataloglaunch-') ) { return catalogLaunchPlanSummary(plan, planRef); }
    if ( plan && typeof plan.id === 'string' && plan.id.startsWith('aichange-') ) { return this.resourcePlanSummary(plan, planRef); }
    if ( !plan || typeof plan.id !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
    const summary = {planRef, serviceName: safeText(plan.serviceName), displayPath: safeText(plan.displayPath, 768) || safeText(plan.serviceName),
      currentImage: imageName(plan.currentImage), requestedImage: imageName(plan.requestedImage || plan.image),
      expiresAt: safeText(plan.expiresAt, 64), confirmationState: safeText(plan.confirmationState || plan.status, 64),
      displayDiff: [{field: 'image', before: imageName(plan.currentImage), after: imageName(plan.requestedImage || plan.image)}]};
    if ( Object.prototype.hasOwnProperty.call(plan, 'upgradeStrategy') ) {
      summary.upgradeStrategy = upgradeStrategy(plan.upgradeStrategy);
      summary.displayDiff.push(...SERVICE_UPGRADE_FIELDS.map((field) => ({field, before: null, after: summary.upgradeStrategy[field]})));
    }
    if ( Object.prototype.hasOwnProperty.call(plan, 'configurationChanges') ) {
      if ( !summary.upgradeStrategy ) { throw new CommandError('INVALID_RESPONSE'); }
      summary.configurationChanges = upgradeConfigurationChanges(plan.configurationChanges);
      summary.displayDiff.push(...summary.configurationChanges);
    }
    return summary;
  }

  async preview_service_upgrade(input, captured, signal) {
    const target = this.context.resolve(input.serviceRef, 'service', captured);
    const data = {serviceId: target.id};
    for ( const field of ['image', ...SERVICE_UPGRADE_FIELDS, ...SERVICE_UPGRADE_CONFIG_FIELDS] ) {
      if ( Object.prototype.hasOwnProperty.call(input, field) ) { data[field] = field === 'ports' ? input[field].slice() : field === 'healthCheck' && input[field] !== null ? {...input[field]} : input[field]; }
    }
    const plan = await this.call(captured, 'aiServiceUpgradePlans', 'POST', data, signal);
    if ( !plan || typeof plan.id !== 'string' || (plan.serviceId && plan.serviceId !== target.id) ) { throw new CommandError('INVALID_RESPONSE'); }
    const planRef = this.context.reference('plan', {id: plan.id, serviceId: target.id}, captured);
    const summary = this.planSummary(plan, planRef);
    if ( summary.upgradeStrategy ) {
      const expected = {startFirst: false, batchSize: 1, intervalMillis: 2000, ...data};
      if ( SERVICE_UPGRADE_FIELDS.some((field) => summary.upgradeStrategy[field] !== expected[field]) ) { throw new CommandError('INVALID_RESPONSE'); }
    } else if ( SERVICE_UPGRADE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(input, field)) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    const requested = SERVICE_UPGRADE_CONFIG_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(data, field));
    const changes = summary.configurationChanges || [];
    if ( changes.length !== requested.length || requested.some(field => !changes.some(row => row.field === field &&
      upgradeConfigurationValue(field, row.after === null ? null : JSON.parse(row.after)) === upgradeConfigurationValue(field, field === 'healthCheck' && data[field] !== null ? {...(row.before === null ? {} : JSON.parse(row.before)), ...data[field]} : data[field]))) ||
      (Object.prototype.hasOwnProperty.call(data, 'image') ? summary.requestedImage !== imageName(data.image) : summary.requestedImage !== summary.currentImage) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    this.context.resolve(planRef, 'plan', captured).upgradeReview = serviceUpgradeReview(summary);
    this.onPlan(Object.assign({context: captured}, summary));
    return Object.assign({status: 'needs_user', nextStep: 'Ask the user to review and confirm the plan in the console.'}, summary);
  }

  async confirmPlan(planRef, options = {}) {
    try {
      const captured = this.context.capture();
      if ( captured.mode !== 'enabled' ) { throw new CommandError('UNAVAILABLE'); }
      const reference = this.context.resolve(planRef, 'plan', captured);
      await this.ensureSession();
      this.context.assertCurrent(captured);
      if ( reference.planKind === 'browser-environment' ) {
        if (this.transportKind !== 'browser' || !this.browserEnvironment || typeof options.currentReview !== 'function' ||
          !options.currentReview() || options.reviewSignature !== reference.reviewSignature || reference.phase !== 'preview' || Date.now() >= reference.expiresAt) { throw new CommandError('CONFLICT'); }
        reference.phase = 'executing';
        try {
          const effect = await this.browserEnvironment.confirm(reference.binding, captured,
            () => options.currentReview() && Date.now() < reference.expiresAt);
          reference.phase = 'completed';
          if (options.currentReview()) { this.onPlan(null, planRef); }
          return {status: 'succeeded', confirmationState: 'approved', verifiedResult: false, ...effect};
        } catch (error) {
          reference.phase = 'failed';
          const result = publicError(error);
          return {...result, verifiedResult: false, nextStep: 'Check the current browser environment or personal default in the console. If another attempt is needed, create a fresh preview for a new human confirmation; do not replay this action.'};
        }
      }
      if ( reference.hostResetReview || reference.containerNetworkReview || reference.serviceLinksReview || reference.stackGroupReview || reference.stackUpgradeReview || ['externalService', 'loadBalancerService', 'volume'].includes(reference.resourceType) && reference.operation === 'create' ) {
        this.assertPlan(await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}`, 'GET'), reference);
      }
      const plan = await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}?action=confirm`, 'POST', {});
      this.assertPlan(plan, reference);
      const summary = this.planSummary(plan, planRef);
      this.onPlan(Object.assign({context: captured}, summary), planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  }

  async apply_service_upgrade(input, captured, signal, observeOperation = this.onOperation) {
    const reference = this.context.resolve(input.planRef, 'plan', captured);
    if ( reference.planKind ) { throw new CommandError('INVALID_INPUT', 'planRef'); }
    this.context.assertCurrent(captured, signal);
    // Reserve recovery before submission. A response can disappear after the
    // server durably accepts this plan; recovering must not create a new plan.
    const operationRef = reference.operationRef || this.context.reference('operation', {id: reference.id, serviceId: reference.serviceId,
      upgradeReview: reference.upgradeReview, lastStatus: 'unknown'}, captured);
    reference.operationRef = operationRef;
    this.context.resolve(operationRef, 'operation', captured).lastStatus = 'unknown';
    let responded = false;
    try {
      const plan = await this.call(captured, `aiServiceUpgradePlans/${encodeURIComponent(reference.id)}?action=apply`, 'POST', {}, signal);
      responded = true;
      this.assertPlan(plan, reference);
      return this.operationSummary(plan, operationRef, observeOperation);
    } catch (error) {
      if ( responded || publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ) {
        throw new UnknownOperation(operationRef);
      }
      const operation = this.context.references.get(operationRef); if ( operation ) { operation.data.lastStatus = 'rejected'; }
      throw error;
    }
  }

  assertPlan(plan, reference) {
    if ( reference.planKind === 'catalog-launch' ) {
      const safe = catalogLaunchPlanSummary(plan, null);
      if ( plan.id !== reference.id || reference.stackName && safe.catalogSummary.stackName !== reference.stackName ||
        reference.catalogIdentity && Object.keys(reference.catalogIdentity).some((field) => safe.catalogSummary[field] !== reference.catalogIdentity[field]) ) {
        throw new CommandError('INVALID_RESPONSE');
      }
      return;
    }
    if ( reference.planKind === 'resource-change' ) {
      const summary = this.resourcePlanSummary(plan, null);
      if ( plan.id !== reference.id || plan.resourceType !== reference.resourceType || plan.operation !== reference.operation ||
        reference.resourceId && plan.resourceId !== reference.resourceId ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( reference.serviceCreateReview && serviceCreateReview(summary) !== reference.serviceCreateReview ) { throw new CommandError('CONFLICT'); }
      if ( reference.stackGroupReview && JSON.stringify([summary.displayPath, summary.displayDiff]) !== reference.stackGroupReview ) { throw new CommandError('CONFLICT'); }
      if ( reference.serviceLinksReview && JSON.stringify([summary.displayPath, summary.displayDiff]) !== reference.serviceLinksReview ) { throw new CommandError('CONFLICT'); }
      if ( reference.containerNetworkReview && containerNetworkReview(summary) !== reference.containerNetworkReview ) { throw new CommandError('CONFLICT'); }
      if ( reference.stackUpgradeReview && stackUpgradeReview(summary) !== reference.stackUpgradeReview ) { throw new CommandError('CONFLICT'); }
      if ( reference.hostResetReview && JSON.stringify([summary.displayPath, summary.displayDiff]) !== reference.hostResetReview ) { throw new CommandError('CONFLICT'); }
      return;
    }
    if ( !plan || plan.id !== reference.id || (plan.serviceId && plan.serviceId !== reference.serviceId) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( reference.upgradeReview && serviceUpgradeReview(this.planSummary(plan, null)) !== reference.upgradeReview ) { throw new CommandError('CONFLICT'); }
  }

  operationSummary(plan, operationRef, observeOperation = this.onOperation) {
    const status = plan.status === 'dispatching' ? 'running' : OPERATION_STATUSES.includes(plan.status) ? plan.status : 'unknown';
    // Terminal success must come with explicit server verification, not merely an HTTP 200.
    const result = {status: status === 'succeeded' && plan.verifiedResult !== true ? 'unknown' : status,
      operationRef, resourceTextIsUntrusted: true, target: {name: safeText(plan.targetPath || plan.serviceName || plan.summary && plan.summary.stackName, 768)},
      verifiedResult: plan.verifiedResult === true, messageCode: safeText(plan.messageCode || plan.reason, 80)};
    const authorizationDenied = result.status === 'failed' && plan.id && plan.id.startsWith('aichange-') &&
      plan.messageCode === 'ResourceChangeAuthorizationDenied';
    let serviceCreateSummary;
    if ( result.status === 'succeeded' && result.verifiedResult && plan.resourceType === 'service' && plan.operation === 'create' ) {
      const summary = this.resourcePlanSummary(plan, null);
      if ( summary.executionResult ) { result.executionResult = summary.executionResult; serviceCreateSummary = summary; }
    }
    if ( authorizationDenied ) {
      Object.assign(result, {code: 'FORBIDDEN', verifiedResult: false, partialEffectsPossible: true,
        nextStep: 'A background authorization check denied this operation. Some changes may already have occurred; completion has not been verified. Check the current permissions, then query this same operationRef and inspect its original receipt and resources in the console. Do not blindly resubmit or approve another change.'});
    }
    if ( result.status === 'needs_user' ) {
      result.code = 'NEEDS_USER'; result.nextStep = 'Ask the user to complete inputs and approve the existing plan in the console. No launch has been verified; do not create a replacement or submit another apply.';
    }
    if ( ['port', 'instanceLink'].includes(plan.resourceType) ) { result.completionScope = 'native-container-network-configuration'; result.applicationConnectivityVerified = false; result.linkEnvironmentRebuilt = false; }
    if ( plan.resourceType === 'volume' && plan.operation === 'create' ) {
      result.completionScope = 'unallocated-local-volume-record'; result.physicalStorageVerified = false; result.mountVerified = false;
      if ( result.status === 'succeeded' && result.verifiedResult ) {
        if ( typeof plan.resourceId !== 'string' || !plan.resourceId || plan.resourceId.length > 128 ) { throw new CommandError('INVALID_RESPONSE'); }
        const captured = this.context.capture(), operation = this.context.resolve(operationRef, 'operation', captured);
        if ( !operation.createdResourceRef ) { operation.createdResourceRef = this.context.reference('resource', {id: plan.resourceId, resourceType: 'volume', family: 'storage', scope: 'project'}, captured); }
        result.createdResource = {resourceType: 'volume', resourceRef: operation.createdResourceRef};
        result.nextStep = 'Only the exact new unallocated local Volume record is verified. Host storage and mounts are not verified. Reuse this createdResource.resourceRef for a fresh safe metadata read; names can repeat, so never select an older first match. Empty usage references never mean unused or safe to delete. Physical allocation and unsupported drivers remain in the human Volume UI.';
      }
    }
    if ( plan.resourceType === 'dnsService' && plan.operation === 'create' ) {
      result.workflow = [...ALIAS_WORKFLOW]; result.targetsBound = false;
      if ( result.status === 'succeeded' && result.verifiedResult === true ) { result.nextStep = ALIAS_CREATE_NEXT_STEP; }
    }
    if ( ['service', 'stack'].includes(plan.resourceType) && plan.operation === 'cancel_upgrade' && result.status === 'succeeded' && result.verifiedResult === true ) {
      result.completionScope = 'cancellation-checkpoint';
      result.nextStep = 'Only the native upgrade cancellation checkpoint is verified. The upgrade or rollback has not been completed. Read the same Service again before requesting a separately approved next operation.';
      if ( plan.resourceType === 'stack' ) {
        result.nextStep = 'Only the native Stack cancellation checkpoint is verified. Individual service upgrades may still be in progress; their completion or cancellation is not established. Read the same Stack and its services before a separately approved finish or rollback.';
      }
    }
    if ( plan.id && plan.id.startsWith('aicataloglaunch-') && plan.createdResource ) {
      const captured = this.context.capture(), created = plan.createdResource;
      if ( created.resourceType !== 'stack' || !this.resourceIdentity(created, resourceDescriptor('stack'), captured) || typeof created.name !== 'string' ) {
        throw new CommandError('INVALID_RESPONSE');
      }
      result.createdResource = {resourceType: 'stack', name: safeText(created.name), resourceRef: this.referenceResource({id: created.id, family: 'stack', resourceType: 'stack', scope: 'project'}, captured)};
    }
    const operation = this.context.references.get(operationRef); if ( operation && operation.kind === 'operation' ) { operation.data.lastStatus = result.status; }
    if ( plan.id && plan.id.startsWith('aicataloglaunch-') ) {
      if ( result.status === 'failed' && ['CatalogLaunchSourceChanged', 'CatalogLaunchPlanExpired', 'CatalogLaunchUnsupported'].includes(plan.reason) ) {
        const failure = publicError({status: plan.reason === 'CatalogLaunchUnsupported' ? 422 : 409, body: {code: plan.reason}});
        result.code = failure.code; result.nextStep = failure.nextStep;
      }
      observeOperation.call(this, {planId: plan.id, status: result.status, planSummary: catalogLaunchPlanSummary(plan, null)});
    } else if ( result.status === 'succeeded' || result.status === 'failed' ) {
      const operation = {planId: plan.id, status: result.status};
      if ( authorizationDenied ) { operation.messageCode = 'ResourceChangeAuthorizationDenied'; }
      if ( serviceCreateSummary ) { operation.planSummary = serviceCreateSummary; }
      if ( this.transportKind === 'stdio' && plan.resourceType === 'project' && plan.operation === 'update_metadata' ) {
        projectOperationNotices.get(this).set(result, Object.assign({}, operation, {resourceType: plan.resourceType,
          operation: plan.operation, resourceId: plan.resourceId, verifiedResult: result.verifiedResult === true}));
      } else { observeOperation.call(this, operation); }
    }
    return result;
  }

  async get_operation(input, captured, signal, observeOperation = this.onOperation) {
    const reference = this.context.resolve(input.operationRef, 'operation', captured);
    let result;
    for ( let check = 0; check < 10; check++ ) {
      const plan = await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}`, 'GET', undefined, signal);
      try { this.assertPlan(plan, reference); }
      catch (error) {
        if ( reference.upgradeReview ) { throw new UnknownOperation(input.operationRef); }
        throw error;
      }
      result = this.operationSummary(plan, input.operationRef, observeOperation);
      if ( !['accepted', 'running'].includes(result.status) ) { return result; }
      if ( check < 9 ) {
        this.context.assertCurrent(captured, signal);
        await this.wait(750, signal);
        this.context.assertCurrent(captured, signal);
      }
    }
    // A bounded read-only wait never re-submits the mutation or claims success.
    return Object.assign(result, {retryAfterMs: 750,
      nextStep: 'The existing operation is still running. Call get_operation again with the same operationRef; do not submit another change.'});
  }

  planCollection(reference) {
    if ( reference.planKind === 'catalog-launch' ) { return CATALOG_LAUNCH_COLLECTION; }
    if ( reference.planKind === 'resource-change' ) { return 'aiResourceChangePlans'; }
    if ( !reference.planKind ) { return 'aiServiceUpgradePlans'; }
    throw new CommandError('INVALID_INPUT', 'planRef');
  }

  existingOperation(input, captured) {
    try {
      this.context.assertCurrent(captured);
      const target = input.targetRef ? this.resolveResourceReference(input.targetRef, input.resourceType, captured, 'targetRef') :
        input.planRef ? this.context.resolve(input.planRef, 'plan', captured) : null;
      if ( !target ) { return null; }
      const id = target.resourceId || target.id, type = target.resourceType || input.resourceType;
      for ( const [reference, entry] of this.context.references ) {
        if ( entry.kind !== 'operation' || entry.epoch !== captured.epoch || !['unknown', 'accepted', 'running'].includes(entry.data.lastStatus) ) { continue; }
        if ( entry.data.resourceType === type && entry.data.resourceId === id || type === 'service' && entry.data.serviceId === id ) { return reference; }
      }
    } catch (error) { /* Never return a reference from another context. */ }
    return null;
  }

  resourcePlanSummary(plan, planRef) {
    if ( !plan || !/^aichange-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id || '') ||
      !Object.prototype.hasOwnProperty.call(RESOURCE_CHANGES, plan.resourceType) ||
      !Object.prototype.hasOwnProperty.call(RESOURCE_CHANGES[plan.resourceType], plan.operation) || typeof plan.targetPath !== 'string' ||
      !Array.isArray(plan.changes) || plan.changes.length > 20 || !['pending', 'approved', 'cancelled'].includes(plan.confirmationState) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( plan.resourceType === 'host' && ['start', 'stop'].includes(plan.operation) ) {
      const before = plan.operation === 'start' ? 'inactive' : 'active', after = plan.operation === 'start' ? 'active' : 'inactive';
      if ( plan.changes.length !== 1 || !plan.changes[0] || plan.changes[0].field !== 'state' ||
        plan.changes[0].before !== before || plan.changes[0].after !== after ) { throw new CommandError('INVALID_RESPONSE'); }
    }
    const displayDiff = plan.changes.map((change) => {
      if ( !change || !RESOURCE_CHANGE_FIELDS.includes(change.field) ||
        ![change.before, change.after].every((value) => value === null || typeof value === 'string' && value.length <= (['command', 'entryPoint', 'targetServices', 'ports', 'healthCheck', 'portRules'].includes(change.field) ? 100000 : 1024) ||
          typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'checkpointOnly' && (plan.resourceType !== 'stack' ||
        !Object.prototype.hasOwnProperty.call(STACK_UPGRADE_LIFECYCLE, plan.operation)) ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'group' && (plan.resourceType !== 'stack' || plan.operation !== 'update_metadata' ||
        [change.before, change.after].some(value => value !== null && (typeof value !== 'string' || value.length > 255 || value.includes('\0')))) ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'driver' && (plan.resourceType !== 'volume' || plan.operation !== 'create' || change.before !== null || change.after !== 'local') ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'portRules' ) {
        if ( plan.resourceType !== 'loadBalancerService' || plan.operation !== 'create' || change.before !== null || typeof change.after !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
        try { validateTcpLoadBalancerReview(JSON.parse(change.after)); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
      }
      if ( change.field === 'hostname' ) {
        if ( plan.resourceType === 'host' ) {
          if ( plan.operation !== 'update_metadata' || typeof change.after !== 'string' || !change.after.trim() || change.after.includes('\0') ||
            change.before !== change.after || !plan.changes.some(row => row.field === 'name' && row.after === '') ) { throw new CommandError('INVALID_RESPONSE'); }
        } else if ( [change.before, change.after].some(value => value !== null && !isExternalHostname(value)) ) { throw new CommandError('INVALID_RESPONSE'); }
      }
      if ( change.field === 'targetServices' ) {
        const ordinaryLinks = plan.resourceType === 'service' && plan.operation === 'update_links';
        if ( !(plan.resourceType === 'dnsService' || ordinaryLinks) || change.after === null || ordinaryLinks && change.before === null ) { throw new CommandError('INVALID_RESPONSE'); }
        safeAliasTargetSummary(change.before); safeAliasTargetSummary(change.after);
      }
      if ( change.field === 'healthCheck' && plan.resourceType === 'externalService' ) {
        if ( plan.operation !== 'create' || change.before !== null || typeof change.after !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
        try { validateExternalServiceHealthCheck(JSON.parse(change.after)); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
      } else if ( SERVICE_CREATE_FIELDS.includes(change.field) ) {
        if ( !(['service', 'container'].includes(plan.resourceType) && (change.field === 'ports' || plan.resourceType === 'service')) ||
          plan.operation !== 'create' || change.before !== null || typeof change.after !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
        try { validateServiceCreateField(change.field, JSON.parse(change.after)); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
      }
      if ( change.field === 'externalIpAddresses' ) {
        for ( const value of [change.before, change.after] ) {
          if ( value === null ) { continue; }
          let addresses;
          try { addresses = JSON.parse(value); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
          if ( !Array.isArray(addresses) || addresses.length < 1 || addresses.length > 16 || new Set(addresses).size !== addresses.length || addresses.some((item) => !isExternalAddress(item)) ) { throw new CommandError('INVALID_RESPONSE'); }
        }
      }
      if ( ['command', 'entryPoint'].includes(change.field) ) {
        for ( const value of [change.before, change.after] ) {
          if ( value === null ) { continue; }
          let items;
          try { items = JSON.parse(value); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
          if ( !Array.isArray(items) || items.length > 64 || items.some((item) => typeof item !== 'string' || item.length > 4096 || item.includes('\u0000')) ||
            items.reduce((total, item) => total + item.length, 0) > 16384 ) { throw new CommandError('INVALID_RESPONSE'); }
        }
      }
      if ( change.field === 'mountedDataRule' && (change.before !== null || change.after !== 'EXISTING_DOMAIN_RETENTION_NO_ADDITIONAL_PURGE') ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( ['affectedServiceCount', 'affectedInstanceCount', 'affectedMountCount'].includes(change.field) &&
        (!Number.isSafeInteger(change.before) || change.before < 0 || change.after !== null && (!Number.isSafeInteger(change.after) || change.after < 0)) ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'affectedMountCount' && change.after !== null || change.field === 'affectedInstanceCount' && change.after !== 0 ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'startOnCreate' && (change.before !== null || (plan.resourceType === 'loadBalancerService' && plan.operation === 'create' ? typeof change.after !== 'boolean' : change.after !== false)) ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( change.field === 'archived' && (!['archive', 'restore'].includes(plan.operation) || typeof change.before !== 'boolean' ||
        typeof change.after !== 'boolean' || change.after !== (plan.operation === 'archive')) ) { throw new CommandError('INVALID_RESPONSE'); }
      return {field: change.field, before: change.before, after: change.after};
    });
    if ( ['port', 'instanceLink'].includes(plan.resourceType) ) {
      const expected = plan.resourceType === 'port' ? ['sourceContainer', 'publicPort', 'privatePort', 'protocol', 'bindAddress'] : ['sourceContainer', 'linkName', 'targetContainer'];
      if ( plan.operation !== (plan.resourceType === 'port' ? 'update_public_port' : 'update_target') || displayDiff.length !== expected.length ||
        new Set(displayDiff.map(row => row.field)).size !== expected.length || displayDiff.some(row => !expected.includes(row.field)) ||
        displayDiff.some(row => !['publicPort', 'targetContainer'].includes(row.field) && row.before !== row.after) ) { throw new CommandError('INVALID_RESPONSE'); }
      for ( const row of displayDiff ) {
        if ( ['publicPort', 'privatePort'].includes(row.field) && [row.before, row.after].some(value => value !== null && (!Number.isInteger(value) || value < 1 || value > 65535)) ||
          row.field === 'protocol' && !['tcp', 'udp'].includes(row.before) ||
          ['sourceContainer', 'linkName'].includes(row.field) && (typeof row.before !== 'string' || !row.before) ||
          row.field === 'targetContainer' && (typeof row.after !== 'string' || !row.after || row.before !== null && typeof row.before !== 'string') ) { throw new CommandError('INVALID_RESPONSE'); }
      }
    }
    if ( displayDiff.filter(change => change.field === 'group').length > 1 ) { throw new CommandError('INVALID_RESPONSE'); }
    if ( plan.operation === 'remove' && ['affectedInstanceCount', 'affectedMountCount', 'mountedDataRule'].some((field) => !displayDiff.some((change) => change.field === field)) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( ['archive', 'restore'].includes(plan.operation) && (displayDiff.length !== 1 || displayDiff[0].field !== 'archived') ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( plan.resourceType === 'volume' && (plan.operation !== 'create' || ![3, 4].includes(displayDiff.length) ||
      new Set(displayDiff.map(row => row.field)).size !== displayDiff.length || !['name', 'driver', 'state'].every(field => displayDiff.some(row => row.field === field)) ||
      displayDiff.some(row => row.before !== null || !['name', 'description', 'driver', 'state'].includes(row.field)) ||
      typeof displayDiff.find(row => row.field === 'name').after !== 'string' ||
      displayDiff.some(row => row.field === 'description' && row.after !== null && typeof row.after !== 'string') ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(displayDiff.find(row => row.field === 'name').after) ||
      displayDiff.find(row => row.field === 'state').after !== 'inactive') ) { throw new CommandError('INVALID_RESPONSE'); }
    if ( plan.operation === 'update_links' && (plan.resourceType !== 'service' || displayDiff.length !== 1 || displayDiff[0].field !== 'targetServices') ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( plan.resourceType === 'service' && Object.prototype.hasOwnProperty.call(SERVICE_UPGRADE_LIFECYCLE, plan.operation) ) {
      const expected = SERVICE_UPGRADE_LIFECYCLE[plan.operation], operation = displayDiff.find((change) => change.field === 'operation'),
        state = displayDiff.find((change) => change.field === 'state');
      if ( displayDiff.length !== 2 || !operation || operation.before !== null || operation.after !== plan.operation ||
        !state || !expected.before.includes(state.before) || state.after !== expected.after ) { throw new CommandError('INVALID_RESPONSE'); }
    }
    if ( plan.resourceType === 'stack' && Object.prototype.hasOwnProperty.call(STACK_UPGRADE_LIFECYCLE, plan.operation) ) {
      const expected = STACK_UPGRADE_LIFECYCLE[plan.operation], operation = displayDiff.find(row => row.field === 'operation'),
        state = displayDiff.find(row => row.field === 'state'), count = displayDiff.find(row => row.field === 'affectedServiceCount'),
        checkpoint = displayDiff.find(row => row.field === 'checkpointOnly');
      if ( displayDiff.length !== 4 || new Set(displayDiff.map(row => row.field)).size !== 4 ||
        !operation || operation.before !== null || operation.after !== plan.operation ||
        !state || !expected.before.includes(state.before) || state.after !== expected.after ||
        !count || !Number.isSafeInteger(count.before) || count.before < 0 || count.after !== count.before ||
        !checkpoint || checkpoint.before !== null || checkpoint.after !== (plan.operation === 'cancel_upgrade') ) {
        throw new CommandError('INVALID_RESPONSE');
      }
    }
    if ( SERVICE_CREATE_FIELDS.some((field) => displayDiff.filter((change) => change.field === field).length > 1) ) { throw new CommandError('INVALID_RESPONSE'); }
    let executionResult;
    if ( plan.executionResult !== undefined && plan.executionResult !== null ) {
      const receipt = plan.executionResult;
      if ( plan.resourceType !== 'service' || plan.operation !== 'create' || plan.status !== 'succeeded' || plan.verifiedResult !== true ||
        !receipt || typeof receipt !== 'object' || Array.isArray(receipt) || Object.keys(receipt).length !== 1 || !Object.prototype.hasOwnProperty.call(receipt, 'assignedPorts') ) { throw new CommandError('INVALID_RESPONSE'); }
      try { validateServiceCreateField('ports', receipt.assignedPorts); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
      executionResult = {assignedPorts: receipt.assignedPorts.slice()};
    }
    return {planRef, planKind: 'resource-change', resourceType: plan.resourceType, operation: plan.operation,
      displayPath: safeText(plan.targetPath, 768), displayDiff, expiresAt: safeText(plan.expiresAt, 64), confirmationState: plan.confirmationState,
      ...(executionResult ? {executionResult, verifiedResult: true, planStatus: 'succeeded'} : {})};
  }

  async preview_resource_change(input, captured, signal) {
    if ( input.operation === 'create_from_catalog' ) { return this.previewCatalogLaunch(input, captured, signal); }
    if ( input.catalogVersionRef ) { throw new CommandError('INVALID_INPUT', 'catalogVersionRef'); }
    const operations = RESOURCE_CHANGES[input.resourceType];
    const descriptor = operations && Object.prototype.hasOwnProperty.call(operations, input.operation) && operations[input.operation];
    if ( !descriptor ) { throw new CommandError('INVALID_INPUT', 'operation'); }
    const parameters = Object.assign({}, input.parameters || {});
    if (descriptor.execution === 'browser-human-confirmation') {
      if (input.resourceType !== 'project' || !input.targetRef || input.parentRef || Object.keys(parameters).length) { throw new CommandError('INVALID_INPUT', 'parameters'); }
      const target = this.resolveResourceReference(input.targetRef, 'project', captured, 'targetRef');
      if (target.scope !== 'global') { throw new CommandError('INVALID_INPUT', 'targetRef'); }
      if (this.transportKind !== 'browser' || !this.browserEnvironment) {
        return {status: 'needs_user', nextStep: 'Use the normal browser console to choose the environment or personal default. This fixed-profile Bridge will not change its identity or environment binding.'};
      }
      const binding = await this.browserEnvironment.preview({id: target.id, operation: input.operation}, captured);
      this.context.assertCurrent(captured, signal);
      const expiresAt = Date.now() + 300000;
      const reference = {planKind: 'browser-environment', binding, expiresAt, phase: 'preview'};
      const planRef = this.context.reference('plan', reference, captured);
      const summary = {planRef, planKind: 'browser-environment', resourceType: 'project', operation: input.operation,
        displayPath: binding.after, displayDiff: [{field: input.operation === 'switch_context' ? 'selectedEnvironment' : 'defaultEnvironment',
          before: binding.before, after: binding.after}, {field: 'selectedEnvironmentDescription', before: null, after: binding.description}],
        confirmationState: 'pending', expiresAt: new Date(expiresAt).toISOString(), verifiedResult: false};
      summary.reviewSignature = JSON.stringify([summary.operation, summary.displayPath, summary.displayDiff, summary.expiresAt]);
      reference.reviewSignature = summary.reviewSignature;
      this.onPlan(Object.assign({context: captured}, summary));
      return {status: 'needs_user', ...summary, nextStep: 'Ask the user to review and perform this browser action with the console confirmation button. Do not call apply to perform it. No native process or native execution proof is created.'};
    }
    // New nested input must not change while the server preview is in flight.
    if ( Array.isArray(parameters.ports) ) { parameters.ports = parameters.ports.slice(); }
    if ( parameters.healthCheck ) { parameters.healthCheck = Object.assign({}, parameters.healthCheck); }
    const missing = descriptor.required.find((field) => !Object.prototype.hasOwnProperty.call(parameters, field));
    if ( missing ) { throw new CommandError('INVALID_INPUT', `parameters.${missing}`); }
    if ( Object.keys(parameters).some((field) => !descriptor.fields.includes(field)) || Object.keys(parameters).length < descriptor.minFields ) {
      throw new CommandError('INVALID_INPUT', 'parameters');
    }
    if ( input.resourceType === 'port' && parameters.publicPort !== null && (!Number.isInteger(parameters.publicPort) || parameters.publicPort < 1 || parameters.publicPort > 65535) ) { throw new CommandError('INVALID_INPUT', 'parameters.publicPort'); }
    if ( input.resourceType === 'instanceLink' ) {
      const destination = this.resolveResourceReference(parameters.targetInstanceRef, 'container', captured, 'parameters.targetInstanceRef');
      if ( destination.resourceType !== 'container' || destination.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'parameters.targetInstanceRef'); }
      if ( !destination.nativeUuid ) { throw new CommandError('STALE_REFERENCE', 'parameters.targetInstanceRef'); }
      parameters.targetInstanceId = destination.id; parameters.targetInstanceUuid = destination.nativeUuid; delete parameters.targetInstanceRef;
    }
    if ( Object.prototype.hasOwnProperty.call(parameters, 'scale') &&
      (input.resourceType === 'loadBalancerService' ? parameters.scale < 1 : parameters.scale > 100) ) {
      throw new CommandError('INVALID_INPUT', 'parameters.scale');
    }
    if ( Object.prototype.hasOwnProperty.call(parameters, 'group') && parameters.group !== null &&
      (typeof parameters.group !== 'string' || parameters.group.length > 255 || parameters.group.includes('\0')) ) { throw new CommandError('INVALID_INPUT', 'parameters.group'); }
    if ( Object.prototype.hasOwnProperty.call(parameters, 'resetName') &&
      (input.resourceType !== 'host' || input.operation !== 'update_metadata' || parameters.resetName !== true || Object.prototype.hasOwnProperty.call(parameters, 'name')) ) { throw new CommandError('INVALID_INPUT', 'parameters.resetName'); }
    if ( input.resourceType === 'volume' && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(parameters.name || '') ) { throw new CommandError('INVALID_INPUT', 'parameters.name'); }
    if ( input.resourceType === 'externalService' ) { validateExternalServiceParameters(input.operation, parameters); }
    if ( input.resourceType === 'dnsService' && input.operation === 'update_targets' ) {
      parameters.serviceIds = aliasTargetIds(parameters.serviceRefs,
        (reference) => this.resolveResourceReference(reference, 'service', captured, 'parameters.serviceRefs'));
      delete parameters.serviceRefs;
    }
    const ordinaryLinks = input.resourceType === 'service' && input.operation === 'update_links';
    if ( ordinaryLinks ) {
      const hasLinks = Object.prototype.hasOwnProperty.call(parameters, 'links'), hasRefs = Object.prototype.hasOwnProperty.call(parameters, 'serviceRefs');
      if ( hasLinks === hasRefs ) { throw new CommandError('INVALID_INPUT', 'parameters'); }
      if ( hasLinks ) {
        parameters.links = ordinaryServiceLinks(parameters.links,
          reference => this.ordinaryServiceReference(reference, captured, 'parameters.links'));
      } else {
        parameters.serviceIds = aliasTargetIds(parameters.serviceRefs,
          reference => this.ordinaryServiceReference(reference, captured, 'parameters.serviceRefs'));
        delete parameters.serviceRefs;
      }
    }
    let tcpExpected;
    if ( input.resourceType === 'loadBalancerService' && input.operation === 'create' ) {
      validateTcpLoadBalancerRules(parameters.portRules);
      tcpExpected = parameters.portRules.map(rule => ({...rule}));
      parameters.portRules = tcpExpected.map(rule => {
        const target = this.resolveResourceReference(rule.serviceRef, 'service', captured, 'parameters.portRules');
        if ( !['service', 'externalService'].includes(target.resourceType) || target.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'parameters.portRules'); }
        const native = {...rule, serviceId: target.id}; delete native.serviceRef; return native;
      });
    }
    let target;
    if ( input.operation === 'create' ) {
      if ( input.targetRef ) { throw new CommandError('INVALID_INPUT', 'targetRef'); }
      if ( ['service', 'externalService', 'dnsService', 'loadBalancerService'].includes(input.resourceType) ) {
        if ( !input.parentRef ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
        const parent = this.resolveResourceReference(input.parentRef, 'stack', captured, 'parentRef');
        if ( parent.resourceType !== 'stack' || parent.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
        parameters.stackId = parent.id;
      } else if ( input.parentRef ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
    } else {
      if ( !input.targetRef || input.parentRef ) { throw new CommandError('INVALID_INPUT', input.parentRef ? 'parentRef' : 'targetRef'); }
      target = ordinaryLinks ? this.ordinaryServiceReference(input.targetRef, captured, 'targetRef') :
        this.resolveResourceReference(input.targetRef, input.resourceType, captured, 'targetRef');
      const selectedProject = input.resourceType === 'project' && input.operation === 'update_metadata' &&
        target.scope === 'global' && target.id === captured.projectId;
      if ( target.resourceType !== input.resourceType ||
        (input.resourceType === 'project' ? !selectedProject : target.scope !== 'project') ) { throw new CommandError('INVALID_INPUT', 'targetRef'); }
      if ( (input.resourceType === 'dnsService' || ordinaryLinks) && (parameters.serviceIds && parameters.serviceIds.includes(target.id) ||
        ordinaryLinks && parameters.links && parameters.links.some(link => link.serviceId === target.id)) ) {
        throw new CommandError('INVALID_INPUT', parameters.links ? 'parameters.links' : 'parameters.serviceRefs');
      }
    }
    if ( this.transportKind === 'stdio' && input.resourceType === 'project' && input.operation === 'update_metadata' &&
      Object.prototype.hasOwnProperty.call(parameters, 'name') ) {
      // Only the adapter's private, freshly checked closure can remove this
      // local setup restriction. It never grants native write authority.
      const ready = await this.canRenameSelectedProject({name: parameters.name, signal});
      this.context.assertCurrent(captured, signal);
      if ( ready !== true ) { throw new CommandError('NEEDS_USER', 'bridge.environmentBinding'); }
    }
    if ( ['port', 'instanceLink'].includes(input.resourceType) ) {
      if ( !target.nativeUuid || !target.parentId || !target.sourceUuid ) { throw new CommandError('STALE_REFERENCE', 'targetRef'); }
      Object.assign(parameters, {resourceUuid: target.nativeUuid, sourceId: target.parentId, sourceUuid: target.sourceUuid});
    }
    const data = {resourceType: input.resourceType, operation: input.operation, parameters};
    if ( target ) { data.resourceId = target.id; }

    const plan = await this.call(captured, 'aiResourceChangePlans', 'POST', data, signal);
    const reference = {id: plan.id, planKind: 'resource-change', resourceType: input.resourceType, operation: input.operation, resourceId: target && target.id};
    this.assertPlan(plan, reference);
    if ( input.resourceType === 'stack' && input.operation === 'update_metadata' && Object.prototype.hasOwnProperty.call(parameters, 'group') ) {
      const summary = this.resourcePlanSummary(plan, null);
      if ( summary.displayDiff.length !== Object.keys(parameters).length ||
        new Set(summary.displayDiff.map(row => row.field)).size !== Object.keys(parameters).length || summary.displayDiff.some(row =>
        !Object.prototype.hasOwnProperty.call(parameters, row.field) || row.after !== parameters[row.field]) ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.stackGroupReview = JSON.stringify([summary.displayPath, summary.displayDiff]);
    }
    if ( input.resourceType === 'host' && parameters.resetName === true ) {
      const summary = this.resourcePlanSummary(plan, null), fields = ['name', 'hostname', ...(Object.prototype.hasOwnProperty.call(parameters, 'description') ? ['description'] : [])];
      if ( summary.displayDiff.length !== fields.length || new Set(summary.displayDiff.map(row => row.field)).size !== fields.length ||
        fields.some(field => !summary.displayDiff.some(row => row.field === field)) ||
        summary.displayDiff.some(row => row.field === 'name' && row.after !== '' || row.field === 'description' && row.after !== parameters.description) ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.hostResetReview = JSON.stringify([summary.displayPath, summary.displayDiff]);
    }
    if ( input.resourceType === 'volume' ) {
      const expected = ['name', ...(Object.prototype.hasOwnProperty.call(parameters, 'description') ? ['description'] : [])];
      if ( expected.some(field => !plan.changes.some(row => row.field === field && row.after === parameters[field])) ||
        plan.changes.some(row => row.field === 'description' && !expected.includes('description')) ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.serviceCreateReview = serviceCreateReview(this.resourcePlanSummary(plan, null));
    }
    if ( ordinaryLinks ) {
      const summary = this.resourcePlanSummary(plan, null);
      if ( safeAliasTargetSummary(summary.displayDiff[0].after).length !== (parameters.links ? parameters.links.length : parameters.serviceIds.length) ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.serviceLinksReview = JSON.stringify([summary.displayPath, summary.displayDiff]);
    }
    if ( input.resourceType === 'loadBalancerService' && input.operation === 'scale' &&
      (plan.changes.length !== 1 || plan.changes[0].field !== 'scale' || plan.changes[0].after !== parameters.scale ||
        !Number.isInteger(plan.changes[0].before) || plan.changes[0].before < 0 || plan.changes[0].before > 2147483647) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    if ( ['service', 'container'].includes(input.resourceType) && input.operation === 'create' ) {
      for ( const field of input.resourceType === 'service' ? SERVICE_CREATE_FIELDS : ['ports'] ) {
        const requested = Object.prototype.hasOwnProperty.call(parameters, field), change = plan.changes.find((item) => item.field === field);
        if ( requested !== !!change ) { throw new CommandError('INVALID_RESPONSE'); }
        if ( requested ) {
          const expected = field === 'healthCheck' ? {...parameters.healthCheck, strategy: parameters.healthCheck.strategy || 'recreate'} : parameters.ports;
          const actual = JSON.parse(change.after);
          if ( field === 'ports' ? JSON.stringify(expected) !== JSON.stringify(actual) :
            Object.keys(expected).length !== Object.keys(actual).length || Object.keys(expected).some((key) => expected[key] !== actual[key]) ) { throw new CommandError('INVALID_RESPONSE'); }
        }
      }
      reference.serviceCreateReview = serviceCreateReview(this.resourcePlanSummary(plan, null));
    }
    if ( input.resourceType === 'externalService' && input.operation === 'create' ) {
      const requested = Object.prototype.hasOwnProperty.call(parameters, 'healthCheck'), change = plan.changes.find((item) => item.field === 'healthCheck');
      if ( requested !== !!change ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( requested ) {
        const actual = JSON.parse(change.after), expected = parameters.healthCheck;
        if ( Object.keys(expected).length !== Object.keys(actual).length || Object.keys(expected).some((key) => expected[key] !== actual[key]) ) { throw new CommandError('INVALID_RESPONSE'); }
      }
      reference.serviceCreateReview = serviceCreateReview(this.resourcePlanSummary(plan, null));
    }
    if ( tcpExpected ) {
      const rules = plan.changes.filter(item => item.field === 'portRules'), starts = plan.changes.filter(item => item.field === 'startOnCreate');
      if ( rules.length !== 1 || starts.length !== 1 || starts[0].after !== parameters.startOnCreate ) { throw new CommandError('INVALID_RESPONSE'); }
      let actual; try { actual = JSON.parse(rules[0].after); validateTcpLoadBalancerReview(actual); } catch (error) { throw new CommandError('INVALID_RESPONSE'); }
      if ( actual.length !== tcpExpected.length || actual.some((rule, index) =>
        ['protocol', 'access', 'sourcePort', 'targetPort'].some(field => rule[field] !== tcpExpected[index][field])) ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.serviceCreateReview = serviceCreateReview(this.resourcePlanSummary(plan, null));
    }
    if ( ['port', 'instanceLink'].includes(input.resourceType) ) {
      const summary = this.resourcePlanSummary(plan, null);
      if ( input.resourceType === 'port' && summary.displayDiff.find(row => row.field === 'publicPort').after !== parameters.publicPort ) { throw new CommandError('INVALID_RESPONSE'); }
      reference.containerNetworkReview = containerNetworkReview(summary);
    }
    if ( input.resourceType === 'stack' && Object.prototype.hasOwnProperty.call(STACK_UPGRADE_LIFECYCLE, input.operation) ) {
      reference.stackUpgradeReview = stackUpgradeReview(this.resourcePlanSummary(plan, null));
    }
    const planRef = this.context.reference('plan', reference, captured);
    const summary = this.resourcePlanSummary(plan, planRef);
    this.onPlan(Object.assign({context: captured}, summary));
    return Object.assign({status: 'needs_user', resourceTextIsUntrusted: true,
      ...(input.resourceType === 'dnsService' && input.operation === 'create' ? {workflow: [...ALIAS_WORKFLOW], targetsBound: false,
        nextStep: `Ask the user to review and approve this create stage. ${ALIAS_CREATE_NEXT_STEP}`} :
        input.resourceType === 'host' && parameters.resetName === true ? {nextStep: 'The custom Host name will be cleared. The read-only hostname row is the restored displayed name; hostname itself is unchanged. Ask the user to review and approve this exact plan.'} :
        {nextStep: 'Ask the user to review and approve this exact change in the console.'})}, summary);
  }

  async apply_resource_change(input, captured, signal, observeOperation = this.onOperation) {
    const reference = this.context.resolve(input.planRef, 'plan', captured);
    if (reference.planKind === 'browser-environment') {
      return {status: 'needs_user', verifiedResult: false, nextStep: reference.phase === 'preview' ? 'Only the user can perform this browser action with the console confirmation button. This tool does not submit it.' : 'This browser confirmation has been consumed. Check the current environment or personal default in the console, then create a fresh preview if needed. Do not replay it.'};
    }
    if ( !['resource-change', 'catalog-launch'].includes(reference.planKind) ) { throw new CommandError('INVALID_INPUT', 'planRef'); }
    const operationRef = reference.operationRef || this.context.reference('operation', Object.assign({}, reference, {lastStatus: 'unknown'}), captured);
    reference.operationRef = operationRef;
    this.context.resolve(operationRef, 'operation', captured).lastStatus = 'unknown';
    let responded = false;
    try {
      if ( reference.hostResetReview || reference.containerNetworkReview || reference.serviceLinksReview || reference.stackGroupReview || reference.stackUpgradeReview || ['externalService', 'loadBalancerService', 'volume'].includes(reference.resourceType) && reference.operation === 'create' ) {
        this.assertPlan(await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}`, 'GET', undefined, signal), reference);
      }
      const plan = await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}?action=apply`, 'POST', {}, signal);
      responded = true;
      this.assertPlan(plan, reference);
      return this.operationSummary(plan, operationRef, observeOperation);
    } catch (error) {
      if ( responded || publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ||
        reference.planKind === 'catalog-launch' && error.code === 'INVALID_RESPONSE' ) {
        if ( reference.planKind === 'catalog-launch' ) { observeOperation.call(this, {planId: reference.id, status: 'unknown'}); }
        throw new UnknownOperation(operationRef);
      }
      const operation = this.context.references.get(operationRef); if ( operation ) { operation.data.lastStatus = 'rejected'; }
      throw error;
    }
  }

  async previewCatalogLaunch(input, captured, signal) {
    if ( input.resourceType !== 'stack' || input.targetRef || input.parentRef || !input.catalogVersionRef ) { throw new CommandError('INVALID_INPUT', 'catalogVersionRef'); }
    const version = this.context.resolve(input.catalogVersionRef, 'resource', captured);
    if ( version.family !== 'catalog' || version.resourceType !== 'catalogTemplateVersion' || version.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'catalogVersionRef'); }
    const plan = await this.catalogLaunch.preview(version, input.parameters || {}, captured, signal);
    const reference = {id: plan.id, planKind: 'catalog-launch', resourceType: 'stack', operation: 'create_from_catalog',
      stackName: input.parameters.name, catalogIdentity: version.catalogIdentity};
    this.assertPlan(plan, reference);
    const planRef = this.context.reference('plan', reference, captured), summary = catalogLaunchPlanSummary(plan, planRef);
    this.onPlan({...summary, context: captured});
    return {status: 'needs_user', resourceTextIsUntrusted: true, ...summary,
      nextStep: 'Ask the user to review this exact Catalog launch in the console, complete human-only inputs and approve it. Never guess secret defaults. Then apply the same planRef and observe get_operation until verified.'};
  }
}
