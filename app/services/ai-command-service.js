import Service, { service } from '@ember/service';
import { CommandEngine } from 'ui/utils/ai-command-engine';
import { publicError, CommandError } from 'ui/utils/ai-command-contract';
import { safeCatalogQuestions, CATALOG_LAUNCH_COLLECTION } from 'ui/utils/ai-catalog-launch';

export default Service.extend({
  commandContext: service('ai-command-context'),
  access: service(),
  userStore: service('user-store'),
  pendingPlan: null,
  operationNotice: null,

  init() {
    this._super(...arguments);
    this.engine = new CommandEngine({
      context: this.get('commandContext').context,
      request: (options) => this.get('userStore').rawRequest(options),
      ensureSession: () => this.get('access').ensureSession(),
      audit: async (event, captured) => {
        const data = {command: event.command, phase: event.phase, status: event.status, reason: event.reason};
        if ( event.correlationId ) { data.correlationId = event.correlationId; }
        const response = await this.get('userStore').rawRequest({
          url: `projects/${encodeURIComponent(captured.projectId)}/aiToolCallEvents`, method: 'POST', data,
        });
        return response.body;
      },
      onPlan: (plan, expectedPlanRef) => this.publishPlan(plan, expectedPlanRef),
      onOperation: (operation) => this.clearCompletedPlan(operation),
      origin: window.location.origin,
      apiEndpoint: this.get('app.apiEndpoint'),
    });
    this.get('commandContext').on('changed', this, this.dismissPendingPlan);
  },

  execute(name, input, options) { return this.engine.execute(name, input, options); },

  publishPlan(plan, expectedPlanRef) {
    if ( expectedPlanRef !== undefined && this.get('pendingPlan.planRef') !== expectedPlanRef ) { return; }
    this.set('operationNotice', null);
    this.set('pendingPlan', plan);
  },

  captureReviewContext() {
    const captured = this.get('commandContext').context.snapshot();
    if ( !captured.generation || !captured.accountId || !captured.projectId || captured.projectId !== captured.schemaProjectId ) {
      throw new CommandError('UNAVAILABLE');
    }
    return captured;
  },

  assertReviewContext(captured) {
    const current = this.captureReviewContext();
    // Human UI approval is bound to the actor/environment, independently of
    // the optional tool channel's off/read-only/enabled activation epoch.
    if ( !captured || current.signature !== captured.signature ) { throw new CommandError('CONTEXT_CHANGED'); }
  },

  reviewInboxPlan(serverPlan, expectedContext) {
    try {
      const captured = this.captureReviewContext();
      if ( expectedContext ) { this.assertReviewContext(expectedContext); }
      const resourceChange = serverPlan && /^aichange-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverPlan.id || '');
      const catalogLaunch = serverPlan && /^aicataloglaunch-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverPlan.id || '');
      if ( !resourceChange && !catalogLaunch && (!serverPlan || !/^aiplan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverPlan.id || '') ||
        typeof serverPlan.serviceId !== 'string' || !serverPlan.serviceId) ) { throw new CommandError('INVALID_INPUT'); }
      const planRef = `human_${this.get('commandContext').context.random()}`;
      const summary = this.engine.planSummary(serverPlan, planRef);
      this.publishPlan(Object.assign({humanOnly: true, serverPlanId: serverPlan.id, serverServiceId: serverPlan.serviceId,
        serverResourceId: serverPlan.resourceId, context: captured}, summary));
      return Object.assign({status: 'needs_user'}, summary);
    } catch (error) { return publicError(error); }
  },

  // Only the human confirmation component calls this method. It is never
  // included in the WebMCP registry; approval is checked again by the server.
  confirmPendingPlan() {
    const plan = this.get('pendingPlan');
    if ( !plan ) { return Promise.resolve(publicError(new CommandError('STALE_REFERENCE', 'planRef'))); }
    if ( plan.humanOnly ) { return this.confirmHumanPlan(plan); }
    return this.engine.confirmPlan(plan.planRef);
  },

  async confirmHumanPlan(plan) {
    try {
      this.assertReviewContext(plan.context);
      await this.get('access').ensureSession();
      this.assertReviewContext(plan.context);
      const response = await this.get('userStore').rawRequest({
        url: `projects/${encodeURIComponent(plan.context.projectId)}/${this.engine.planCollection(plan)}/${encodeURIComponent(plan.serverPlanId)}?action=confirm`,
        method: 'POST', data: {},
      });
      this.assertReviewContext(plan.context);
      const body = response.body;
      if ( !body || body.id !== plan.serverPlanId || body.confirmationState !== 'approved' ) {
        throw new CommandError('INVALID_RESPONSE');
      }
      if ( plan.planKind === 'catalog-launch' ) { this.assertCatalogHumanPlan(body, plan); }
      else if ( plan.planKind === 'resource-change' ? body.resourceType !== plan.resourceType || body.operation !== plan.operation || body.resourceId !== plan.serverResourceId : body.serviceId !== plan.serverServiceId ) { throw new CommandError('INVALID_RESPONSE'); }
      const summary = this.engine.planSummary(body, plan.planRef);
      this.publishPlan(Object.assign({}, plan, summary), plan.planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  },

  dismissPendingPlan() { this.set('operationNotice', null); this.set('pendingPlan', null); },

  catalogHumanPlanId(plan) {
    if ( !plan || plan.planKind !== 'catalog-launch' || this.get('pendingPlan.planRef') !== plan.planRef ) { throw new CommandError('STALE_REFERENCE', 'planRef'); }
    this.assertReviewContext(plan.context);
    return plan.humanOnly ? plan.serverPlanId : this.get('commandContext').context.resolve(plan.planRef, 'plan', plan.context).id;
  },

  assertCatalogHumanPlan(body, plan) {
    const id = plan.humanOnly ? plan.serverPlanId : this.get('commandContext').context.resolve(plan.planRef, 'plan', plan.context).id;
    const expected = plan.catalogSummary;
    this.engine.assertPlan(body, {id, planKind: 'catalog-launch', stackName: expected.stackName,
      catalogIdentity: {templateKey: expected.templateKey, catalogScope: expected.catalogScope, catalogId: expected.catalogId, version: expected.version, revision: expected.revision}});
  },

  // Human form metadata only. Secret answers never enter pendingPlan or refs.
  async catalogHumanForm(plan) {
    const id = this.catalogHumanPlanId(plan);
    await this.get('access').ensureSession(); this.catalogHumanPlanId(plan);
    const response = await this.get('userStore').rawRequest({url: `projects/${encodeURIComponent(plan.context.projectId)}/${CATALOG_LAUNCH_COLLECTION}/${encodeURIComponent(id)}`, method: 'GET'});
    this.catalogHumanPlanId(plan); this.assertCatalogHumanPlan(response.body, plan);
    const summary = this.engine.planSummary(response.body, plan.planRef);
    this.publishPlan({...plan, ...summary}, plan.planRef);
    const questions = summary.planStatus === 'needs_user' && !summary.inputsReady ? safeCatalogQuestions(response.body.missingHumanInputs || []) : [];
    const referenceChoices = {};
    for ( const type of [...new Set(questions.filter((question) => question.type === 'reference').map((question) => question.referenceType))] ) {
      const choices = []; let marker;
      for ( let page = 0; page < 20; page++ ) {
        this.catalogHumanPlanId(plan);
        const data = {resourceType: type}; if ( marker ) { data.marker = marker; }
        const result = await this.get('userStore').rawRequest({url: `projects/${encodeURIComponent(plan.context.projectId)}/aiResourceViews`, method: 'POST', data});
        this.catalogHumanPlanId(plan);
        if ( !result.body || result.body.resourceType !== type || !Array.isArray(result.body.data) || result.body.data.length > 50 ) { throw new CommandError('INVALID_RESPONSE'); }
        for ( const resource of result.body.data ) {
          if ( !resource || typeof resource.id !== 'string' || typeof resource.name !== 'string' ) { throw new CommandError('INVALID_RESPONSE'); }
          choices.push({value: resource.id, label: resource.stackName ? `${resource.stackName}/${resource.name}` : resource.name});
        }
        const next = result.body.nextMarker;
        if ( !next ) { break; }
        if ( typeof next !== 'string' || next.length > 128 || next === marker || page === 19 ) { throw new CommandError('UNAVAILABLE'); }
        marker = next;
      }
      referenceChoices[type] = choices;
    }
    return {questions, referenceChoices, summary};
  },

  // Cookie-only UI action. This method is never exposed by COMMANDS.
  async completeCatalogHumanInputs(plan, inputs) {
    let submitted = false;
    try {
      const id = this.catalogHumanPlanId(plan);
      await this.get('access').ensureSession(); this.catalogHumanPlanId(plan);
      submitted = true;
      const response = await this.get('userStore').rawRequest({url: `projects/${encodeURIComponent(plan.context.projectId)}/${CATALOG_LAUNCH_COLLECTION}/${encodeURIComponent(id)}?action=completeInputs`, method: 'POST', data: inputs});
      this.catalogHumanPlanId(plan); this.assertCatalogHumanPlan(response.body, plan);
      const summary = this.engine.planSummary(response.body, plan.planRef);
      this.publishPlan({...plan, ...summary}, plan.planRef);
      return {status: 'succeeded', ...summary};
    } catch (error) {
      const result = publicError(error);
      return submitted && (result.status === 'unknown' || ['CONTEXT_CHANGED', 'STALE_REFERENCE', 'INVALID_RESPONSE'].includes(result.code)) ?
        {status: 'unknown', code: 'UNKNOWN_RESULT', nextStep: 'Refresh this existing plan in the console before continuing. Do not automatically resubmit human inputs.'} : result;
    }
  },

  canCancelInboxPlan(plan) {
    return !!plan && ['preview', 'needs_user'].includes(plan.status) && ['pending', 'approved'].includes(plan.confirmationState) &&
      (plan.operationId === undefined || plan.operationId === null);
  },

  // Ordinary human UI only. Never exposed by COMMANDS or the Key bridge.
  async cancelInboxPlan(plan, expectedContext) {
    let submitted = false;
    try {
      const captured = expectedContext || this.captureReviewContext();
      this.assertReviewContext(captured);
      if ( !plan || !/^(aiplan|aichange|aicataloglaunch)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id || '') ) { throw new CommandError('INVALID_INPUT'); }
      if ( !this.canCancelInboxPlan(plan) ) { return {status: 'rejected', code: 'CONFLICT', reason: 'CANNOT_CANCEL'}; }
      const summary = this.engine.planSummary(plan, null);
      await this.get('access').ensureSession(); this.assertReviewContext(captured);
      submitted = true;
      const response = await this.get('userStore').rawRequest({
        url: `projects/${encodeURIComponent(captured.projectId)}/${this.engine.planCollection(summary)}/${encodeURIComponent(plan.id)}?action=cancel`, method: 'POST', data: {},
      });
      this.assertReviewContext(captured);
      const body = response.body;
      if ( !body || body.id !== plan.id || body.confirmationState !== 'cancelled' || !['preview', 'cancelled'].includes(body.status) || body.operationId ) { throw new CommandError('INVALID_RESPONSE'); }
      if ( summary.planKind === 'catalog-launch' ) { this.engine.assertPlan(body, {id: plan.id, planKind: 'catalog-launch', stackName: summary.catalogSummary.stackName}); }
      else if ( summary.planKind === 'resource-change' ? body.resourceType !== plan.resourceType || body.operation !== plan.operation || body.resourceId !== plan.resourceId : body.serviceId !== plan.serviceId ) { throw new CommandError('INVALID_RESPONSE'); }
      const pending = this.get('pendingPlan');
      if ( pending ) {
        try {
          if ( pending.humanOnly ) {
            this.assertReviewContext(pending.context);
            if ( pending.serverPlanId === plan.id ) { this.set('pendingPlan', null); }
          } else {
            const reference = this.get('commandContext').context.resolve(pending.planRef, 'plan', pending.context);
            if ( reference.id === plan.id ) { this.set('pendingPlan', null); }
          }
        } catch (error) { /* A stale pending view cannot alter the verified cancellation. */ }
      }
      return {status: 'succeeded', confirmationState: 'cancelled'};
    } catch (error) {
      const result = publicError(error);
      if ( submitted && (result.status === 'unknown' || result.code === 'CONTEXT_CHANGED') ) {
        return {status: 'unknown', code: 'UNKNOWN_RESULT', nextStep: 'Refresh the plan inbox in an authorized session. Do not assume the cancellation succeeded or automatically resubmit it.'};
      }
      if ( result.code === 'CONFLICT' ) { result.reason = 'CANNOT_CANCEL'; }
      return result;
    }
  },

  clearCompletedPlan(operation) {
    const pending = this.get('pendingPlan');
    if ( !pending ) { return; }
    try {
      let samePlan;
      if ( pending.humanOnly ) {
        this.assertReviewContext(pending.context);
        samePlan = pending.serverPlanId === operation.planId;
      } else {
        const reference = this.get('commandContext').context.resolve(pending.planRef, 'plan', pending.context);
        samePlan = reference.id === operation.planId;
      }
      if ( !samePlan ) { return; }
      if ( ['succeeded', 'failed'].includes(operation.status) ) {
        const denied = pending.planKind === 'resource-change' && operation.status === 'failed' && operation.messageCode === 'ResourceChangeAuthorizationDenied';
        this.set('operationNotice', denied ? {code: 'ResourceChangeAuthorizationDenied'} : null);
        this.set('pendingPlan', null);
      }
      else if ( pending.planKind === 'catalog-launch' && operation.planSummary && operation.planSummary.planKind === 'catalog-launch' ) {
        this.publishPlan({...pending, ...operation.planSummary, planRef: pending.planRef}, pending.planRef);
      } else if ( pending.planKind === 'catalog-launch' && operation.status === 'unknown' ) {
        this.publishPlan({...pending, planStatus: 'unknown', verifiedResult: false}, pending.planRef);
      }
    } catch (error) { /* A stale completion cannot change the current plan. */ }
  },

  willDestroy() {
    this.get('commandContext').off('changed', this, this.dismissPendingPlan);
    this._super(...arguments);
  },
});
