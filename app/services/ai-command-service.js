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
      if ( !serverPlan || !/^aiplan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverPlan.id || '') ||
        typeof serverPlan.serviceId !== 'string' || !serverPlan.serviceId ) { throw new CommandError('INVALID_INPUT'); }
      const planRef = `human_${this.get('commandContext').context.random()}`;
      const summary = this.engine.planSummary(serverPlan, planRef);
      this.publishPlan(Object.assign({humanOnly: true, serverPlanId: serverPlan.id, serverServiceId: serverPlan.serviceId, context: captured}, summary));
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
        url: `projects/${encodeURIComponent(plan.context.projectId)}/aiServiceUpgradePlans/${encodeURIComponent(plan.serverPlanId)}?action=confirm`,
        method: 'POST', data: {},
      });
      this.assertReviewContext(plan.context);
      const body = response.body;
      if ( !body || body.id !== plan.serverPlanId || body.serviceId !== plan.serverServiceId || body.confirmationState !== 'approved' ) {
        throw new CommandError('INVALID_RESPONSE');
      }
      const summary = this.engine.planSummary(body, plan.planRef);
      this.publishPlan(Object.assign({}, plan, summary), plan.planRef);
      return Object.assign({status: 'succeeded'}, summary);
    } catch (error) { return publicError(error); }
  },

  dismissPendingPlan() { this.set('pendingPlan', null); },

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
