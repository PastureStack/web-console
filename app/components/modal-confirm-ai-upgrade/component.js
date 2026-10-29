import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import ModalBase from 'lacsso/components/modal-base';
import { resourceReviewLabels } from 'ui/utils/ai-resource-review-labels';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  attributeBindings: ['role', 'aria-modal', 'aria-labelledby'],
  role: 'dialog',
  'aria-modal': 'true',
  'aria-labelledby': 'ai-upgrade-title',
  commands: service('ai-command-service'),
  intl: service(),
  plan: alias('modalService.modalOpts.plan'),
  saving: false,
  approved: false,
  alreadyApproved: computed('approved', 'plan.confirmationState', function() { return this.get('approved') || this.get('plan.confirmationState') === 'approved'; }),
  errors: null,
  isResourceChange: computed('plan.planKind', function() { return this.get('plan.planKind') === 'resource-change'; }),
  reviewLabels: computed('plan.displayDiff.[]', 'plan.resourceType', 'plan.operation', 'intl.primaryLocale', function() {
    return resourceReviewLabels(this.get('plan') || {}, (key) => this.get('intl').t(key));
  }),
  displayExpiry: computed('plan.expiresAt', 'intl.primaryLocale', function() {
    const value = new Date(this.get('plan.expiresAt'));
    if (!Number.isFinite(value.getTime())) { return ''; }
    return value.toLocaleString(this.get('intl.primaryLocale') || undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });
  }),
  stale: computed('plan.planRef', 'commands.pendingPlan.planRef', function() {
    return !this.get('plan.planRef') || this.get('plan.planRef') !== this.get('commands.pendingPlan.planRef');
  }),
  submitDisabled: computed('saving', 'alreadyApproved', 'stale', function() {
    return this.get('saving') || this.get('alreadyApproved') || this.get('stale');
  }),

  didInsertElement() {
    this._super(...arguments);
    const cancel = this.element.querySelector('[data-testid="ai-upgrade-cancel"]');
    if (cancel) { cancel.focus(); }
  },

  escToClose() { return !this.get('saving') && this._super(...arguments); },

  actions: {
    confirm() {
      if (this.get('submitDisabled')) { return; }
      this.setProperties({saving: true, errors: null});
      return this.get('commands').confirmPendingPlan().then((result) => {
        if (this.isDestroyed || this.isDestroying) { return; }
        if (result.status !== 'succeeded' || result.confirmationState !== 'approved') {
          this.set('errors', [this.get('intl').t(result.code === 'STALE_REFERENCE' || result.code === 'CONTEXT_CHANGED' ? 'webmcp.stale' : 'webmcp.failed')]);
          return;
        }
        this.set('approved', true);
      }, () => {
        if (!this.isDestroyed && !this.isDestroying) { this.set('errors', [this.get('intl').t('webmcp.failed')]); }
      }).finally(() => {
        if (!this.isDestroyed && !this.isDestroying) { this.set('saving', false); }
      });
    },
    cancel() {
      if (this.get('saving')) { return; }
      // Dismissal never grants approval and never revokes the user's login.
      this.get('modalService').toggleModal();
    },
  },
});
