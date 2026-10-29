import { COMMANDS, COMMAND_VERSION, MAX_PAGE_SIZE, CommandError, publicError, safeText, validateInput } from './ai-command-contract';

const OPERATION_STATUSES = ['accepted', 'running', 'succeeded', 'failed', 'unknown'];

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
  constructor({context, request, ensureSession, audit = async () => { throw new CommandError('UNAVAILABLE'); }, wait = waitForOperationPoll, onPlan = () => {}, onOperation = () => {}, origin = 'https://localhost', apiEndpoint = '/v2-beta'}) {
    Object.assign(this, {context, request, ensureSession, audit, wait, onPlan, onOperation, origin, apiEndpoint});
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
        name === 'apply_service_upgrade' && result && result.operationRef;
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
    if ( ['get_service', 'update_service_description'].includes(name) && result.code === 'CONFLICT' ) {
      result.nextStep = 'The service description changed. Find the service again and read its current description before deciding on an update.';
    } else if ( name === 'update_service_description' && result.code === 'STALE_REFERENCE' ) {
      result.nextStep = 'Use get_service to load this reference description first. If the reference expired, find the service again.';
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
        return name === 'apply_service_upgrade' && businessStarted ? this.unknownOutcome(result.operationRef, captured) : publicError(contextError);
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
      nextStep: 'The operation may have been accepted. Query the existing plan using an authorized session; do not submit another upgrade.'};
    if ( operationRef ) {
      try {
        this.context.assertCurrent(captured);
        this.context.resolve(operationRef, 'operation', captured);
        outcome.operationRef = operationRef;
        outcome.nextStep = 'Call get_operation with this operationRef. Do not submit another upgrade.';
      } catch (contextError) { /* No old reference is published into the new context. */ }
    }
    return outcome;
  }

  unknownDescriptionOutcome() {
    return {status: 'unknown', code: 'UNKNOWN_RESULT', contractVersion: COMMAND_VERSION,
      nextStep: 'Find the service again and use get_service to inspect its description. Do not automatically retry the description update.'};
  }

  prefix(captured) { return `projects/${encodeURIComponent(captured.projectId)}`; }

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
      const plan = await this.call(captured, `aiServiceUpgradePlans/${encodeURIComponent(reference.id)}?action=confirm`, 'POST', {});
      this.assertPlan(plan, reference);
      const summary = this.planSummary(plan, planRef);
      this.onPlan(Object.assign({context: captured}, summary), planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  }

  async apply_service_upgrade(input, captured, signal) {
    const reference = this.context.resolve(input.planRef, 'plan', captured);
    this.context.assertCurrent(captured, signal);
    // Reserve recovery before submission. A response can disappear after the
    // server durably accepts this plan; recovering must not create a new plan.
    const operationRef = reference.operationRef || this.context.reference('operation', {id: reference.id, serviceId: reference.serviceId}, captured);
    reference.operationRef = operationRef;
    try {
      const plan = await this.call(captured, `aiServiceUpgradePlans/${encodeURIComponent(reference.id)}?action=apply`, 'POST', {}, signal);
      this.assertPlan(plan, reference);
      return this.operationSummary(plan, operationRef);
    } catch (error) {
      if ( publicError(error).status === 'unknown' || error.code === 'CONTEXT_CHANGED' ) {
        throw new UnknownOperation(operationRef);
      }
      throw error;
    }
  }

  assertPlan(plan, reference) {
    if ( !plan || plan.id !== reference.id || (plan.serviceId && plan.serviceId !== reference.serviceId) ) {
      throw new CommandError('INVALID_RESPONSE');
    }
  }

  operationSummary(plan, operationRef) {
    const status = OPERATION_STATUSES.includes(plan.status) ? plan.status : 'unknown';
    // Terminal success must come with explicit server verification, not merely an HTTP 200.
    const result = {status: status === 'succeeded' && plan.verifiedResult !== true ? 'unknown' : status,
      operationRef, resourceTextIsUntrusted: true, target: {name: safeText(plan.serviceName)},
      verifiedResult: plan.verifiedResult === true, messageCode: safeText(plan.messageCode, 80)};
    if ( result.status === 'succeeded' || result.status === 'failed' ) {
      this.onOperation({planId: plan.id, status: result.status});
    }
    return result;
  }

  async get_operation(input, captured, signal) {
    const reference = this.context.resolve(input.operationRef, 'operation', captured);
    let result;
    for ( let check = 0; check < 10; check++ ) {
      const plan = await this.call(captured, `aiServiceUpgradePlans/${encodeURIComponent(reference.id)}`, 'GET', undefined, signal);
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
      nextStep: 'The existing operation is still running. Call get_operation again with the same operationRef; do not submit another upgrade.'});
  }
}
