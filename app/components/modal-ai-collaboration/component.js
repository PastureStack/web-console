import { computed } from '@ember/object';
import { service } from '@ember/service';
import ModalBase from 'lacsso/components/modal-base';
import config from 'ui/config/environment';
import { boundedCollaborationMode, collaborationStatusKey } from 'ui/utils/ai-collaboration-controls';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  attributeBindings: ['role', 'aria-modal', 'aria-labelledby'],
  role: 'dialog',
  'aria-modal': 'true',
  'aria-labelledby': 'ai-collaboration-title',
  registry: service('webmcp-registry'),
  commands: service('ai-command-service'),
  commandContext: service('ai-command-context'),
  access: service(),
  projects: service(),
  userStore: service('user-store'),
  intl: service(),
  buildMode: config.APP.webmcpMode,
  loading: false,
  changing: false,
  loadError: false,
  hasLoaded: false,
  plans: null,
  canEnable: computed('buildMode', function() { return this.get('buildMode') === 'enabled'; }),
  statusKey: computed('registry.status', function() { return collaborationStatusKey(this.get('registry.status')); }),

  init() {
    this._super(...arguments);
    this.set('plans', []);
    this._loadGeneration = 0;
    this.get('commandContext').on('changed', this, this.invalidateInbox);
  },

  didInsertElement() {
    this._super(...arguments);
    return this.loadPlans();
  },

  invalidateInbox() {
    this._loadGeneration++;
    if ( !this.isDestroying && !this.isDestroyed ) { this.setProperties({plans: [], loading: false, hasLoaded: false, loadError: false}); }
  },

  currentLoad(generation, captured) {
    if ( this.isDestroying || this.isDestroyed || generation !== this._loadGeneration ) { return false; }
    this.get('commands').assertReviewContext(captured);
    return true;
  },

  async loadPlans() {
    const generation = ++this._loadGeneration;
    this.setProperties({loading: true, loadError: false, plans: [], hasLoaded: false});
    let captured;
    try {
      captured = this.get('commands').captureReviewContext();
      await this.get('access').ensureSession();
      if ( !this.currentLoad(generation, captured) ) { return; }
      const response = await this.get('userStore').rawRequest({
        url: `projects/${encodeURIComponent(captured.projectId)}/aiServiceUpgradePlans?limit=20`, method: 'GET',
      });
      if ( !this.currentLoad(generation, captured) ) { return; }
      if ( !response.body || !Array.isArray(response.body.data) || response.body.data.length > 20 ) { throw new Error('InvalidInbox'); }
      const plans = response.body.data.map((plan) => {
        if ( !/^aiplan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id || '') || typeof plan.serviceId !== 'string' ) {
          throw new Error('InvalidInboxPlan');
        }
        const safe = this.get('commands').engine.planSummary(plan, null);
        return Object.assign({id: plan.id, serviceId: plan.serviceId}, safe);
      });
      this._loadedContext = captured;
      this.setProperties({plans, hasLoaded: true});
    } catch (error) {
      if ( !this.isDestroying && !this.isDestroyed && generation === this._loadGeneration ) { this.set('loadError', true); }
    } finally {
      if ( !this.isDestroying && !this.isDestroyed && generation === this._loadGeneration ) { this.set('loading', false); }
    }
  },

  willDestroy() {
    this._loadGeneration++;
    this.get('commandContext').off('changed', this, this.invalidateInbox);
    this._super(...arguments);
  },

  actions: {
    async mode(requested) {
      this.set('changing', true);
      try { await this.get('registry').setMode(boundedCollaborationMode(this.get('buildMode'), requested)); }
      finally { if ( !this.isDestroying && !this.isDestroyed ) { this.set('changing', false); } }
    },
    refresh() { return this.loadPlans(); },
    review(plan) {
      if ( this.isDestroying || this.isDestroyed ) { return; }
      const result = this.get('commands').reviewInboxPlan(plan, this._loadedContext);
      if ( result.status !== 'needs_user' ) { this.set('loadError', true); return; }
      this.get('modalService').toggleModal();
    },
  },
});
