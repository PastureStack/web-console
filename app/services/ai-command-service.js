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
      onPlan: (plan) => this.set('pendingPlan', plan),
      origin: window.location.origin,
      apiEndpoint: this.get('app.apiEndpoint'),
    });
    this.get('commandContext').on('changed', this, this.dismissPendingPlan);
  },

  execute(name, input, options) { return this.engine.execute(name, input, options); },

  // Only the human confirmation component calls this method. It is never
  // included in the WebMCP registry; approval is checked again by the server.
  confirmPendingPlan() {
    const plan = this.get('pendingPlan');
    if ( !plan ) { return Promise.resolve(publicError(new CommandError('STALE_REFERENCE', 'planRef'))); }
    return this.engine.confirmPlan(plan.planRef);
  },

  dismissPendingPlan() { this.set('pendingPlan', null); },

  willDestroy() {
    this.get('commandContext').off('changed', this, this.dismissPendingPlan);
    this._super(...arguments);
  },
});
