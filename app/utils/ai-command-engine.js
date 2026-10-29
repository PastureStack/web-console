import { COMMANDS, COMMAND_VERSION, MAX_PAGE_SIZE, CommandError, publicError, safeText, validateInput } from './ai-command-contract';
import { RESOURCE_FAMILIES, RESOURCE_CHANGES, RESOURCE_CHANGE_FIELDS, resourceFamily, resourceDescriptor, safeResourceFields, truncatedResourceFields } from './ai-resource-registry';

const OPERATION_STATUSES = ['accepted', 'running', 'succeeded', 'failed', 'unknown', 'cancelled'];
const APPLY_COMMANDS = ['apply_service_upgrade', 'apply_resource_change'];

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

export class CommandEngine {
  constructor({context, request, ensureSession, audit = async () => { throw new CommandError('UNAVAILABLE'); }, wait = waitForOperationPoll, onPlan = () => {}, onOperation = () => {}, origin = 'https://localhost', apiEndpoint = '/v2-beta', transportKind = 'browser'}) {
    Object.assign(this, {context, request, ensureSession, audit, wait, onPlan, onOperation, origin, apiEndpoint, transportKind});
  }

  async execute(name, input, options = {}) {
    let captured, result, startAck, businessStarted = false, descriptionMayHaveSaved = false;
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
      businessStarted = true;
      result = await this[name](input, captured, options.signal);
      descriptionMayHaveSaved = name === 'update_service_description' && result.saved === true;
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
      }
    }
    if ( result.reason === 'TARGET_BUSY' ) {
      const operationRef = this.existingOperation(input, captured);
      if ( operationRef ) { result.operationRef = operationRef; result.nextStep = 'Call get_operation with this existing operationRef and wait for completion. Then read the resource again before previewing. Do not submit parallel changes.'; }
    }
    if ( ['get_service', 'update_service_description'].includes(name) && result.code === 'CONFLICT' ) {
      result.nextStep = 'The service description changed. Find the service again and read its current description before deciding on an update.';
    } else if ( name === 'update_service_description' && result.code === 'STALE_REFERENCE' ) {
      result.nextStep = 'Use get_service to load this reference description first. If the reference expired, find the service again.';
    } else if ( name === 'preview_resource_change' && ['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code) ) {
      const repairs = {
        'parameters.image': 'Provide the exact user-requested image in parameters.image. Ask the user if it is missing; never guess an image or version.',
        'parameters.name': 'Provide the requested name in parameters.name, from 1 to 255 UTF-16 units.',
        'parameters.scale': 'Provide an integer from 0 through 100 in parameters.scale.',
        'parameters.description': 'Provide the complete description as a string of at most 1024 UTF-16 units, or null. An empty string clears it.',
        operation: 'Use list_capabilities and choose an implemented operation for this resource type.',
      };
      result.nextStep = repairs[result.field] || (result.field && /^parameters\.(command|entryPoint)(\[\d+\])?$/.test(result.field) ?
        'Use a string array: at most 64 items, 4096 UTF-16 units per item, 16384 in total, and no NUL. These arrays are supported only for service/container create.' :
        'Use find_resources for the target family and reuse its resourceRef as targetRef. For service create, find the stack and pass its resourceRef as parentRef. Send only the fields supported by this operation.');
    }
    if ( !startAck ) { return result; }
    try {
      await this.recordAudit({command: commandName, phase: 'result', status: result.status,
        reason: result.code || 'NONE', correlationId: startAck.requestId}, captured);
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
    return result;
  }

  async recordAudit(event, captured) {
    this.context.assertCurrent(captured);
    let acknowledgement;
    try { acknowledgement = await this.audit(event, captured); } catch (error) {
      this.context.assertCurrent(captured);
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
  usesResourceView(descriptor) { return descriptor.readTransport === 'view' || this.transportKind === 'stdio'; }

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
        const supported = this.supportsResource(descriptor), needsCheck = supported && this.usesResourceView(descriptor);
        return {resourceType: descriptor.type, scope: descriptor.scope, coverageStatus: supported && !descriptor.limitations.length ? 'implemented' : 'pending-adapter',
          metadataLimitations: [...descriptor.limitations],
          canFind: needsCheck ? null : supported && !!definition && Array.isArray(definition.collectionMethods) && definition.collectionMethods.includes('GET'),
          canGet: needsCheck ? null : supported && !!definition && Array.isArray(definition.resourceMethods) && definition.resourceMethods.includes('GET'),
          authorization: needsCheck ? 'requires-server-check' : 'role-schema',
          safeFields: [...descriptor.fields], parentType: descriptor.parent ? descriptor.parent.type : null,
          operations: RESOURCE_CHANGES[descriptor.type] ? Object.keys(RESOURCE_CHANGES[descriptor.type]) : [],
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

  async find_resources(input, captured, signal) {
    const descriptor = this.findDescriptor(input);
    let parent;
    if ( input.parentRef ) {
      parent = this.resolveResourceReference(input.parentRef, descriptor.parent && descriptor.parent.type, captured, 'parentRef');
      if ( !descriptor.parent || parent.resourceType !== descriptor.parent.type || parent.scope !== descriptor.scope ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
    }
    let path = `${this.resourcePath(descriptor, captured)}?limit=${MAX_PAGE_SIZE}`, marker;
    if ( parent ) { path += `&${descriptor.parent.field}=${encodeURIComponent(parent.id)}`; }
    if ( input.cursor ) {
      const cursor = this.context.resolve(input.cursor, 'resourceCursor', captured);
      if ( cursor.family !== input.family || cursor.resourceType !== descriptor.type || cursor.query !== (input.query || '') || cursor.parentRef !== (input.parentRef || '') ) {
        throw new CommandError('INVALID_INPUT', 'cursor');
      }
      path = cursor.path; marker = cursor.marker;
    }
    const useView = this.usesResourceView(descriptor);
    const body = useView ? await this.resourceView(descriptor, captured, {query: input.query, marker, parentId: parent && parent.id}, signal) :
      await this.readResourcePath(path, captured, signal);
    if ( !Array.isArray(body.data) || body.data.length > MAX_PAGE_SIZE ) { throw new CommandError('INVALID_RESPONSE'); }
    const next = useView ? body.nextMarker : this.resourceNext(body.pagination && body.pagination.next, descriptor, captured, parent);
    const nextCursor = next ? this.context.reference('resourceCursor', {family: input.family, resourceType: descriptor.type,
      query: input.query || '', parentRef: input.parentRef || '', path: useView ? null : next,
      marker: useView ? next : null}, captured) : null;
    const items = body.data.filter((item) => this.resourceIdentity(item, descriptor, captured) && this.matches(item, input.query) &&
      (!parent || item[descriptor.parent.field] === parent.id)).map((item) => {
      const resourceRef = this.referenceResource({id: item.id, family: input.family, resourceType: descriptor.type, scope: descriptor.scope}, captured);
      const parentId = descriptor.parent && item[descriptor.parent.field];
      const parentRef = parentId && typeof parentId === 'string' ? this.referenceResource({id: parentId, family: descriptor.parent.type,
        resourceType: descriptor.parent.type, scope: descriptor.scope}, captured) : null;
      return {resourceRef, resourceType: descriptor.type, scope: descriptor.scope,
        parentRef, parentResolution: descriptor.parent ? safeText(item.stackName) ? 'resolved' : 'unavailable' : null,
        displayPath: safeText(item.displayPath, 768) || `${descriptor.scope === 'project' ? safeText(captured.projectName) : '(global)'}/${parentRef ? safeText(item.stackName) || '(parent unavailable)' : input.family}/${safeText(item.name) || descriptor.type}`,
        fields: safeResourceFields(item, descriptor), truncatedFields: truncatedResourceFields(item, descriptor)};
    });
    const result = {status: 'succeeded', resourceTextIsUntrusted: true, family: input.family, resourceType: descriptor.type, scope: descriptor.scope,
      items, nextCursor, complete: !nextCursor};
    if ( items.some((item) => item.parentResolution === 'unavailable') ) {
      result.nextStep = 'Some parent names are unavailable. Find the visible stack by name and pass its resourceRef as parentRef to narrow this search. Do not choose a duplicate automatically.';
    }
    return result;
  }

  async get_resource(input, captured, signal) {
    const target = this.context.resolve(input.resourceRef, 'resource', captured);
    const descriptor = this.findDescriptor({family: target.family, resourceType: target.resourceType});
    let body;
    if ( this.usesResourceView(descriptor) ) {
      const view = await this.resourceView(descriptor, captured, {resourceId: target.id}, signal);
      if ( view.data.length !== 1 ) { throw new CommandError('INVALID_RESPONSE'); }
      body = view.data[0];
    } else { body = await this.readResourcePath(`${this.resourcePath(descriptor, captured)}/${encodeURIComponent(target.id)}`, captured, signal); }
    if ( !this.resourceIdentity(body, descriptor, captured) || body.id !== target.id ) { throw new CommandError('INVALID_RESPONSE'); }
    return {status: 'succeeded', resourceTextIsUntrusted: true, resourceRef: input.resourceRef, family: target.family,
      resourceType: descriptor.type, scope: descriptor.scope, fields: safeResourceFields(body, descriptor), truncatedFields: truncatedResourceFields(body, descriptor)};
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

  async resourceView(descriptor, captured, options, signal) {
    const data = {resourceType: descriptor.type};
    for ( const field of ['resourceId', 'query', 'marker', 'parentId'] ) {
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

  matches(item, query) { return !query || safeText(item.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()); }

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
    if ( plan && typeof plan.id === 'string' && plan.id.startsWith('aichange-') ) { return this.resourcePlanSummary(plan, planRef); }
    if ( !plan || typeof plan.id !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
    return {planRef, serviceName: safeText(plan.serviceName), displayPath: safeText(plan.displayPath, 768) || safeText(plan.serviceName),
      currentImage: imageName(plan.currentImage), requestedImage: imageName(plan.requestedImage || plan.image),
      expiresAt: safeText(plan.expiresAt, 64), confirmationState: safeText(plan.confirmationState || plan.status, 64),
      displayDiff: [{field: 'image', before: imageName(plan.currentImage), after: imageName(plan.requestedImage || plan.image)}]};
  }

  async preview_service_upgrade(input, captured, signal) {
    const target = this.context.resolve(input.serviceRef, 'service', captured);
    const plan = await this.call(captured, 'aiServiceUpgradePlans', 'POST', {serviceId: target.id, image: input.image}, signal);
    if ( !plan || typeof plan.id !== 'string' || (plan.serviceId && plan.serviceId !== target.id) ) { throw new CommandError('INVALID_RESPONSE'); }
    const planRef = this.context.reference('plan', {id: plan.id, serviceId: target.id}, captured);
    const summary = this.planSummary(plan, planRef);
    this.onPlan(Object.assign({context: captured}, summary));
    return Object.assign({status: 'needs_user', nextStep: 'Ask the user to review and confirm the plan in the console.'}, summary);
  }

  async confirmPlan(planRef) {
    try {
      const captured = this.context.capture();
      if ( captured.mode !== 'enabled' ) { throw new CommandError('UNAVAILABLE'); }
      const reference = this.context.resolve(planRef, 'plan', captured);
      await this.ensureSession();
      this.context.assertCurrent(captured);
      const plan = await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}?action=confirm`, 'POST', {});
      this.assertPlan(plan, reference);
      const summary = this.planSummary(plan, planRef);
      this.onPlan(Object.assign({context: captured}, summary), planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  }

  async apply_service_upgrade(input, captured, signal) {
    const reference = this.context.resolve(input.planRef, 'plan', captured);
    if ( reference.planKind === 'resource-change' ) { throw new CommandError('INVALID_INPUT', 'planRef'); }
    this.context.assertCurrent(captured, signal);
    // Reserve recovery before submission. A response can disappear after the
    // server durably accepts this plan; recovering must not create a new plan.
    const operationRef = reference.operationRef || this.context.reference('operation', {id: reference.id, serviceId: reference.serviceId, lastStatus: 'unknown'}, captured);
    reference.operationRef = operationRef;
    this.context.resolve(operationRef, 'operation', captured).lastStatus = 'unknown';
    try {
      const plan = await this.call(captured, `aiServiceUpgradePlans/${encodeURIComponent(reference.id)}?action=apply`, 'POST', {}, signal);
      this.assertPlan(plan, reference);
      return this.operationSummary(plan, operationRef);
    } catch (error) {
      if ( publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ) {
        throw new UnknownOperation(operationRef);
      }
      const operation = this.context.references.get(operationRef); if ( operation ) { operation.data.lastStatus = 'rejected'; }
      throw error;
    }
  }

  assertPlan(plan, reference) {
    if ( reference.planKind === 'resource-change' ) {
      this.resourcePlanSummary(plan, null);
      if ( plan.id !== reference.id || plan.resourceType !== reference.resourceType || plan.operation !== reference.operation ||
        reference.resourceId && plan.resourceId !== reference.resourceId ) { throw new CommandError('INVALID_RESPONSE'); }
      return;
    }
    if ( !plan || plan.id !== reference.id || (plan.serviceId && plan.serviceId !== reference.serviceId) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
  }

  operationSummary(plan, operationRef) {
    const status = plan.status === 'dispatching' ? 'running' : OPERATION_STATUSES.includes(plan.status) ? plan.status : 'unknown';
    // Terminal success must come with explicit server verification, not merely an HTTP 200.
    const result = {status: status === 'succeeded' && plan.verifiedResult !== true ? 'unknown' : status,
      operationRef, resourceTextIsUntrusted: true, target: {name: safeText(plan.targetPath || plan.serviceName, 768)},
      verifiedResult: plan.verifiedResult === true, messageCode: safeText(plan.messageCode, 80)};
    const operation = this.context.references.get(operationRef); if ( operation && operation.kind === 'operation' ) { operation.data.lastStatus = result.status; }
    if ( result.status === 'succeeded' || result.status === 'failed' ) {
      this.onOperation({planId: plan.id, status: result.status});
    }
    return result;
  }

  async get_operation(input, captured, signal) {
    const reference = this.context.resolve(input.operationRef, 'operation', captured);
    let result;
    for ( let check = 0; check < 10; check++ ) {
      const plan = await this.call(captured, `${this.planCollection(reference)}/${encodeURIComponent(reference.id)}`, 'GET', undefined, signal);
      this.assertPlan(plan, reference);
      result = this.operationSummary(plan, input.operationRef);
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

  planCollection(reference) { return reference.planKind === 'resource-change' ? 'aiResourceChangePlans' : 'aiServiceUpgradePlans'; }

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
    const displayDiff = plan.changes.map((change) => {
      if ( !change || !RESOURCE_CHANGE_FIELDS.includes(change.field) ||
        ![change.before, change.after].every((value) => value === null || typeof value === 'string' && value.length <= (['command', 'entryPoint'].includes(change.field) ? 100000 : 1024) ||
          typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) ) { throw new CommandError('INVALID_RESPONSE'); }
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
      if ( change.field === 'startOnCreate' && (change.before !== null || change.after !== false) ) { throw new CommandError('INVALID_RESPONSE'); }
      return {field: change.field, before: change.before, after: change.after};
    });
    if ( plan.operation === 'remove' && ['affectedInstanceCount', 'affectedMountCount', 'mountedDataRule'].some((field) => !displayDiff.some((change) => change.field === field)) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
    return {planRef, planKind: 'resource-change', resourceType: plan.resourceType, operation: plan.operation,
      displayPath: safeText(plan.targetPath, 768), displayDiff, expiresAt: safeText(plan.expiresAt, 64), confirmationState: plan.confirmationState};
  }

  async preview_resource_change(input, captured, signal) {
    const operations = RESOURCE_CHANGES[input.resourceType];
    const descriptor = operations && Object.prototype.hasOwnProperty.call(operations, input.operation) && operations[input.operation];
    if ( !descriptor ) { throw new CommandError('INVALID_INPUT', 'operation'); }
    const parameters = Object.assign({}, input.parameters || {});
    const missing = descriptor.required.find((field) => !Object.prototype.hasOwnProperty.call(parameters, field));
    if ( missing ) { throw new CommandError('INVALID_INPUT', `parameters.${missing}`); }
    if ( Object.keys(parameters).some((field) => !descriptor.fields.includes(field)) || Object.keys(parameters).length < descriptor.minFields ) {
      throw new CommandError('INVALID_INPUT', 'parameters');
    }
    let target;
    if ( input.operation === 'create' ) {
      if ( input.targetRef ) { throw new CommandError('INVALID_INPUT', 'targetRef'); }
      if ( input.resourceType === 'service' ) {
        if ( !input.parentRef ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
        const parent = this.resolveResourceReference(input.parentRef, 'stack', captured, 'parentRef');
        if ( parent.resourceType !== 'stack' || parent.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
        parameters.stackId = parent.id;
      } else if ( input.parentRef ) { throw new CommandError('INVALID_INPUT', 'parentRef'); }
    } else {
      if ( !input.targetRef || input.parentRef ) { throw new CommandError('INVALID_INPUT', input.parentRef ? 'parentRef' : 'targetRef'); }
      target = this.resolveResourceReference(input.targetRef, input.resourceType, captured, 'targetRef');
      if ( target.resourceType !== input.resourceType || target.scope !== 'project' ) { throw new CommandError('INVALID_INPUT', 'targetRef'); }
    }
    const data = {resourceType: input.resourceType, operation: input.operation, parameters};
    if ( target ) { data.resourceId = target.id; }
    const plan = await this.call(captured, 'aiResourceChangePlans', 'POST', data, signal);
    const reference = {id: plan.id, planKind: 'resource-change', resourceType: input.resourceType, operation: input.operation, resourceId: target && target.id};
    this.assertPlan(plan, reference);
    const planRef = this.context.reference('plan', reference, captured);
    const summary = this.resourcePlanSummary(plan, planRef);
    this.onPlan(Object.assign({context: captured}, summary));
    return Object.assign({status: 'needs_user', resourceTextIsUntrusted: true, nextStep: 'Ask the user to review and approve this exact change in the console.'}, summary);
  }

  async apply_resource_change(input, captured, signal) {
    const reference = this.context.resolve(input.planRef, 'plan', captured);
    if ( reference.planKind !== 'resource-change' ) { throw new CommandError('INVALID_INPUT', 'planRef'); }
    const operationRef = reference.operationRef || this.context.reference('operation', Object.assign({}, reference, {lastStatus: 'unknown'}), captured);
    reference.operationRef = operationRef;
    this.context.resolve(operationRef, 'operation', captured).lastStatus = 'unknown';
    try {
      const plan = await this.call(captured, `aiResourceChangePlans/${encodeURIComponent(reference.id)}?action=apply`, 'POST', {}, signal);
      this.assertPlan(plan, reference);
      return this.operationSummary(plan, operationRef);
    } catch (error) {
      if ( publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ) { throw new UnknownOperation(operationRef); }
      const operation = this.context.references.get(operationRef); if ( operation ) { operation.data.lastStatus = 'rejected'; }
      throw error;
    }
  }
}
