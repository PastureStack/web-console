import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import ModalBase from 'lacsso/components/modal-base';
import { resourceReviewLabels } from 'ui/utils/ai-resource-review-labels';
import { createCatalogHumanForm } from 'ui/utils/ai-catalog-human-form';
import { observer } from '@ember/object';

const humanForms = new WeakMap();

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  attributeBindings: ['role', 'aria-modal', 'aria-labelledby'],
  role: 'dialog',
  'aria-modal': 'true',
  'aria-labelledby': 'ai-upgrade-title',
  commands: service('ai-command-service'),
  store: service('store'),
  intl: service(),
  plan: alias('modalService.modalOpts.plan'),
  saving: false,
  approved: false,
  alreadyApproved: computed('approved', 'plan.confirmationState', function() { return this.get('approved') || this.get('plan.confirmationState') === 'approved'; }),
  errors: null,
  isResourceChange: computed('plan.planKind', function() { return ['resource-change', 'catalog-launch'].includes(this.get('plan.planKind')); }),
  isCatalogLaunch: computed('plan.planKind', function() { return this.get('plan.planKind') === 'catalog-launch'; }),
  catalogIdentityLabels: computed('plan.catalogSummary', 'intl.primaryLocale', function() {
    const summary = this.get('plan.catalogSummary') || {};
    const scope = ['global', 'project'].includes(summary.catalogScope) ? this.get('intl').t(`apiKeyAccess.scopes.${summary.catalogScope}`) : '';
    return {source: `${scope} / ${summary.catalogId || ''} / ${summary.templateKey || ''} · ${summary.templateName || ''}`,
      version: `${summary.version || ''}${Number.isSafeInteger(summary.revision) ? ` (r${summary.revision})` : ''}`};
  }),
  catalogAfterPreview: computed('isCatalogLaunch', 'plan.planStatus', function() { return this.get('isCatalogLaunch') && this.get('plan.planStatus') !== 'needs_user'; }),
  catalogStatusKey: computed('plan.planStatus', 'plan.verifiedResult', function() {
    const status = this.get('plan.planStatus');
    const outcome = {needs_user: 'NOT_EXECUTED', accepted: 'ACCEPTED', running: 'PENDING', failed: 'FAILED', cancelled: 'NOT_EXECUTED'}[status];
    return `apiKeyAudit.outcomes.${status === 'succeeded' && this.get('plan.verifiedResult') ? 'SUCCEEDED' : outcome || 'unknown'}`;
  }),
  humanQuestions: null,
  loadingHumanInputs: false,
  savingHumanInputs: false,
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
  submitDisabled: computed('saving', 'alreadyApproved', 'stale', 'savingHumanInputs', 'plan.inputsReady', 'plan.planStatus', 'isCatalogLaunch', function() {
    return this.get('saving') || this.get('alreadyApproved') || this.get('stale') || this.get('savingHumanInputs') ||
      this.get('isCatalogLaunch') && (!this.get('plan.inputsReady') || this.get('plan.planStatus') !== 'needs_user');
  }),

  clearHumanInputs() {
    const form = humanForms.get(this); if ( form ) { form.clear(); }
    humanForms.delete(this);
    if ( !this.isDestroyed && !this.isDestroying ) { this.set('humanQuestions', []); }
  },

  pendingChanged: observer('commands.pendingPlan', 'commands.pendingPlan.planRef', function() {
    const current = this.get('commands.pendingPlan'), plan = this.get('plan');
    if ( !current || !plan || plan.planRef !== current.planRef ) { this.clearHumanInputs(); }
    else if ( plan.planKind === 'catalog-launch' ) {
      if ( current !== plan ) { this.set('modalService.modalOpts.plan', current); }
      if ( current.inputsReady || current.planStatus !== 'needs_user' ) { this.clearHumanInputs(); }
    }
  }),

  async loadHumanInputs() {
    const plan = this.get('plan');
    if ( !plan || plan.planKind !== 'catalog-launch' || plan.planStatus !== 'needs_user' || plan.inputsReady || this.get('stale') ) { return; }
    this.set('loadingHumanInputs', true);
    try {
      const result = await this.get('commands').catalogHumanForm(plan);
      if ( this.isDestroyed || this.isDestroying || this.get('stale') ) { return; }
      const current = this.get('commands.pendingPlan');
      if ( current && current.planRef === plan.planRef ) { this.set('modalService.modalOpts.plan', current); }
      if ( result.summary && (result.summary.inputsReady || result.summary.planStatus !== 'needs_user') ) { this.clearHumanInputs(); return; }
      // Existing schema selectors retain their ordinary human UI semantics.
      for ( const type of [...new Set(result.questions.filter((question) => question.type !== 'reference' && ['secret', 'certificate'].includes(question.sourceType)).map((question) => question.sourceType))] ) {
        await this.get('store').findAll(type); this.get('commands').catalogHumanPlanId(plan);
      }
      if ( this.isDestroyed || this.isDestroying || this.get('stale') ) { return; }
      this.clearHumanInputs();
      const form = createCatalogHumanForm(result.questions, result.referenceChoices, this.get('intl').t('generic.none')); humanForms.set(this, form);
      this.set('humanQuestions', form.fields);
    } catch (error) {
      if ( !this.isDestroyed && !this.isDestroying ) { this.set('errors', [this.get('intl').t('webmcp.failed')]); }
    } finally {
      if ( !this.isDestroyed && !this.isDestroying ) { this.set('loadingHumanInputs', false); }
    }
  },

  didInsertElement() {
    this._super(...arguments);
    const cancel = this.element.querySelector('[data-testid="ai-upgrade-cancel"]');
    if (cancel) { cancel.focus(); }
    this.loadHumanInputs();
  },

  willDestroyElement() { this.clearHumanInputs(); this._super(...arguments); },

  escToClose() { return !this.get('saving') && !this.get('savingHumanInputs') && this._super(...arguments); },

  actions: {
    async completeInputs() {
      if ( this.get('savingHumanInputs') || this.get('stale') ) { return; }
      const form = humanForms.get(this), plan = this.get('plan');
      if ( !form || plan.planKind !== 'catalog-launch' ) { return; }
      let reloadInputs = false;
      this.setProperties({savingHumanInputs: true, errors: null});
      try {
        const result = await this.get('commands').completeCatalogHumanInputs(plan, form.payload());
        if ( this.isDestroyed || this.isDestroying || this.get('stale') ) { return; }
        if ( result.status !== 'succeeded' ) {
          reloadInputs = result.status !== 'unknown';
          this.set('errors', [this.get('intl').t(result.status === 'unknown' ? 'webmcp.catalogInputUnknown' : 'webmcp.failed')]); return;
        }
        const current = this.get('commands.pendingPlan');
        if ( current && current.planRef === plan.planRef ) { this.set('modalService.modalOpts.plan', current); }
        reloadInputs = current && !current.inputsReady;
      } catch (error) {
        reloadInputs = true;
        if ( !this.isDestroyed && !this.isDestroying ) { this.set('errors', [this.get('intl').t('webmcp.failed')]); }
      } finally {
        this.clearHumanInputs();
        if ( !this.isDestroyed && !this.isDestroying ) { this.set('savingHumanInputs', false); }
        if ( reloadInputs && !this.isDestroyed && !this.isDestroying && !this.get('stale') ) { await this.loadHumanInputs(); }
      }
    },
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
      if (this.get('saving') || this.get('savingHumanInputs')) { return; }
      this.clearHumanInputs();
      // Dismissal never grants approval and never revokes the user's login.
      this.get('modalService').toggleModal();
    },
  },
});
