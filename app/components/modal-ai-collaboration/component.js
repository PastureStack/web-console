import { computed } from '@ember/object';
import { service } from '@ember/service';
import ModalBase from 'lacsso/components/modal-base';
import config from 'ui/config/environment';
import { boundedCollaborationMode, collaborationStatusKey } from 'ui/utils/ai-collaboration-controls';
import { resourceReviewLabels } from 'ui/utils/ai-resource-review-labels';

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
  cancelCandidate: null,
  cancelling: false,
  cancelNotice: null,
  errors: null,
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
    if ( !this.isDestroying && !this.isDestroyed ) { this.setProperties({plans: [], loading: false, hasLoaded: false, loadError: false, cancelCandidate: null, cancelling: false, cancelNotice: null, errors: null}); }
  },

  currentLoad(generation, captured) {
    if ( this.isDestroying || this.isDestroyed || generation !== this._loadGeneration ) { return false; }
    this.get('commands').assertReviewContext(captured);
    return true;
  },

  async loadPlans() {
    const generation = ++this._loadGeneration;
    this.setProperties({loading: true, loadError: false, plans: [], hasLoaded: false, cancelCandidate: null, cancelNotice: null, errors: null});
    let captured;
    try {
      captured = this.get('commands').captureReviewContext();
      await this.get('access').ensureSession();
      if ( !this.currentLoad(generation, captured) ) { return; }
      const responses = await Promise.all(['aiServiceUpgradePlans', 'aiResourceChangePlans'].map((collection) =>
        this.get('userStore').rawRequest({url: `projects/${encodeURIComponent(captured.projectId)}/${collection}?limit=20`, method: 'GET'})));
      if ( !this.currentLoad(generation, captured) ) { return; }
      const plans = responses.flatMap((response, index) => {
        if ( !response.body || !Array.isArray(response.body.data) || response.body.data.length > 20 ) { throw new Error('InvalidInbox'); }
        return response.body.data.map((plan) => {
          const resourceChange = index === 1;
          if ( !(resourceChange ? /^aichange-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i : /^aiplan-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(plan.id || '') ||
            !resourceChange && typeof plan.serviceId !== 'string' ) {
            throw new Error('InvalidInboxPlan');
          }
          const safe = this.get('commands').engine.planSummary(plan, null);
          const typed = resourceChange ? {targetPath: safe.displayPath, changes: safe.displayDiff,
            ...resourceReviewLabels(safe, (key) => this.get('intl').t(key))} : {};
          return Object.assign({id: plan.id, serviceId: plan.serviceId, resourceId: plan.resourceId, status: plan.status, operationId: plan.operationId,
            canCancel: this.get('commands').canCancelInboxPlan(plan)}, safe, typed);
        });
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
    requestCancel(plan) {
      if ( this.get('cancelling') || !plan.canCancel ) { return; }
      this.setProperties({cancelCandidate: plan, errors: null, cancelNotice: null});
    },
    keepPlan() { if ( !this.get('cancelling') ) { this.set('cancelCandidate', null); } },
    async cancelPlan() {
      const plan = this.get('cancelCandidate'), generation = this._loadGeneration, captured = this._loadedContext;
      if ( !plan || this.get('cancelling') || !this.get('plans').includes(plan) ) { return; }
      this.setProperties({cancelling: true, errors: null});
      try {
        const result = await this.get('commands').cancelInboxPlan(plan, captured);
        if ( !this.currentLoad(generation, captured) ) { return; }
        if ( result.status === 'succeeded' && result.confirmationState === 'cancelled' ) {
          this.setProperties({plans: this.get('plans').filter((entry) => entry.id !== plan.id), cancelCandidate: null, cancelNotice: this.get('intl').t('webmcp.planCancelled')});
        } else {
          if ( result.reason === 'CANNOT_CANCEL' ) {
            this.setProperties({plans: this.get('plans').map((entry) => entry.id === plan.id ? Object.assign({}, entry, {canCancel: false}) : entry), cancelCandidate: null});
          }
          this.set('errors', [this.get('intl').t(result.reason === 'CANNOT_CANCEL' ? 'webmcp.cannotCancel' : 'webmcp.cancelFailed')]);
        }
      } catch (error) {
        if ( !this.isDestroying && !this.isDestroyed && generation === this._loadGeneration ) { this.set('errors', [this.get('intl').t('webmcp.cancelFailed')]); }
      } finally {
        if ( !this.isDestroying && !this.isDestroyed && generation === this._loadGeneration ) { this.set('cancelling', false); }
      }
    },
    review(plan) {
      if ( this.isDestroying || this.isDestroyed ) { return; }
      const result = this.get('commands').reviewInboxPlan(plan, this._loadedContext);
      if ( result.status !== 'needs_user' ) { this.set('loadError', true); return; }
      this.get('modalService').toggleModal();
    },
  },
});
