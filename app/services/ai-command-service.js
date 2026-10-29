import Service, { service } from '@ember/service';
import { CommandEngine } from 'ui/utils/ai-command-engine';
import { publicError, CommandError } from 'ui/utils/ai-command-contract';

export default Service.extend({
  commandContext: service('ai-command-context'),
  access: service(),
  userStore: service('user-store'),
  pendingPlan: null,

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
      if ( !resourceChange && (!serverPlan || !/^aiplan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverPlan.id || '') ||
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
      if ( !body || body.id !== plan.serverPlanId || body.confirmationState !== 'approved' ||
        (plan.planKind === 'resource-change' ? body.resourceType !== plan.resourceType || body.operation !== plan.operation || body.resourceId !== plan.serverResourceId : body.serviceId !== plan.serverServiceId) ) {
        throw new CommandError('INVALID_RESPONSE');
      }
      const summary = this.engine.planSummary(body, plan.planRef);
      this.publishPlan(Object.assign({}, plan, summary), plan.planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  },

  dismissPendingPlan() { this.set('pendingPlan', null); },

  canCancelInboxPlan(plan) {
    return !!plan && plan.status === 'preview' && ['pending', 'approved'].includes(plan.confirmationState) &&
      (plan.operationId === undefined || plan.operationId === null);
  },

  // Ordinary human UI only. Never exposed by COMMANDS or the Key bridge.
  async cancelInboxPlan(plan, expectedContext) {
    let submitted = false;
    try {
      const captured = expectedContext || this.captureReviewContext();
      this.assertReviewContext(captured);
      if ( !plan || !/^(aiplan|aichange)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id || '') ) { throw new CommandError('INVALID_INPUT'); }
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
      if ( summary.planKind === 'resource-change' ? body.resourceType !== plan.resourceType || body.operation !== plan.operation || body.resourceId !== plan.resourceId : body.serviceId !== plan.serviceId ) { throw new CommandError('INVALID_RESPONSE'); }
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
    if ( !pending || !['succeeded', 'failed'].includes(operation.status) ) { return; }
    try {
      if ( pending.humanOnly ) {
        this.assertReviewContext(pending.context);
        if ( pending.serverPlanId === operation.planId ) { this.set('pendingPlan', null); }
        return;
      }
      const reference = this.get('commandContext').context.resolve(pending.planRef, 'plan', pending.context);
      if ( reference.id === operation.planId ) { this.set('pendingPlan', null); }
    } catch (error) { /* A stale completion cannot change the current plan. */ }
  },

  willDestroy() {
    this.get('commandContext').off('changed', this, this.dismissPendingPlan);
    this._super(...arguments);
  },
});
