import { alias } from '@ember/object/computed';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import { getOwner } from '@ember/application';
import { resolve } from 'rsvp';
import { bindCreateOnlyDelivery, cloneCreateOnlyDelivery, takeCreateOnlyDelivery } from 'ember-api-store/utils/create-only-delivery';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';
import { API_KEY_RESOURCE_TYPES, initialPolicy, policyErrors, plain, localExpiry, expiryIso, apiKeyError, policiesEqual } from 'ui/utils/api-key-policy';
import { ownerOperationStates, scopeKey } from 'ui/utils/api-key-owner-capabilities';
import { selectionMatches } from 'ui/utils/api-key-scope-selection';
import { buildPolicyMatrix } from 'ui/utils/api-key-policy-matrix';
import C from 'ui/utils/constants';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal', 'api-key-editor-modal'],
  originalModel: alias('modalService.modalOpts'),
  model: null,
  clone: null,
  justCreated: false,
  createOnlyDelivery: true,

  intl: service(),
  endpoint: null,
  userStore: null,
  resourceTypes: API_KEY_RESOURCE_TYPES,
  policyDraft: null,
  review: null,
  confirmed: false,
  policyError: null,
  expiryChoice: 'none',
  expiryLocal: '',
  conflict: false,
  confirmationOptions: null,
  savedReadback: null,
  readbackPending: false,
  capabilityEvidence: null,
  scopeReloadGeneration: 0,
  matrixNow: null,

  ownerContextKnown: function() {
    return !this.get('originalModel.id') || !!this.get('originalModel.accountId') &&
      this.get('originalModel.accountId') === this.get(`session.${C.SESSION.ACCOUNT_ID}`);
  }.property('originalModel.id', 'originalModel.accountId', `session.${C.SESSION.ACCOUNT_ID}`),

  editingLocked: function() {
    return this.get('saving') || !!this.get('confirmationOptions') || this.get('readbackPending');
  }.property('saving', 'confirmationOptions', 'readbackPending'),

  legacyKey: function() {
    return !!this.get('originalModel.id') && Number(this.get('originalModel.apiKeyPolicyRevision') || 0) === 0;
  }.property('originalModel.id', 'originalModel.apiKeyPolicyRevision'),

  policySupported: function() {
    return !!this.get('originalModel.schema.resourceFields.apiKeyPolicy');
  }.property('originalModel.schema.resourceFields.apiKeyPolicy'),

  isCustom: function() {
    return this.get('policyDraft.mode') === 'custom';
  }.property('policyDraft.mode'),

  defaultEffect: function() {
    let policy = this.get('policyDraft') || {};
    return policy.mode === 'full' ? 'allow' : policy.mode === 'closed' ? 'deny' : policy.defaultEffect;
  }.property('policyDraft.mode', 'policyDraft.defaultEffect'),

  reviewDisabled: function() {
    return this.get('saving') || this.get('conflict') || this.get('readbackPending') || !!this.get('confirmationOptions');
  }.property('saving', 'conflict', 'readbackPending', 'confirmationOptions'),

  reviewExpired: function() {
    let deadline = Date.parse(this.get('review.apiKeyPolicy.expiresAt'));
    return Number.isFinite(deadline) && deadline <= (this.get('matrixNow') || Date.now());
  }.property('review', 'matrixNow'),

  submitDisabled: function() {
    return this.get('saving') || !this.get('confirmed') || !this.get('review') || !!this.get('confirmationOptions') || this.get('reviewExpired');
  }.property('saving', 'confirmed', 'review', 'confirmationOptions', 'reviewExpired'),

  rules: function() {
    return (this.get('policyDraft.rules') || []).map((rule) => Object.assign({}, rule, {
      global: rule.scope.kind === 'global',
      resource: rule.scope.kind === 'resource',
      operationsView: ownerOperationStates(rule.scope, (this.get('capabilityEvidence') || {})[rule.id], this.get('ownerContextKnown'))
        .map((item) => Object.assign({}, item, {checked: rule.operations.includes(item.operation), disabled: rule.effect === 'allow' && item.unavailable})),
    }));
  }.property('policyDraft.rules.[]', 'capabilityEvidence', 'ownerContextKnown'),

  reviewRules: function() {
    return (this.get('review.apiKeyPolicy.rules') || []).map((rule) => Object.assign({}, rule, {
      targetLabel: (this.get('review.scopeLabels') || {})[rule.id],
      operationLabels: rule.operations.map((operation) => String(this.get('intl').t(`apiKeyAccess.operations.${operation}`))),
    }));
  }.property('review', 'intl._locale'),

  matrixLabels() {
    let intl = this.get('intl');
    return {default: intl.t('apiKeyAccess.matrix.other'), global: intl.t('apiKeyAccess.matrix.global'),
      unverified: intl.t('apiKeyAccess.matrix.unverified')};
  },

  matrixEvidence(evidence = {}) {
    return plain({scopeKey: evidence.scopeKey, selectionValid: evidence.selectionValid,
      selectionLabel: evidence.selectionLabel, selectionStatus: evidence.selectionStatus,
      contextVerified: evidence.contextVerified, complete: evidence.complete,
      projectId: evidence.projectId, stackId: evidence.stackId,
      stackContextStatus: evidence.stackContextStatus,
      resource: evidence.resource && {id: evidence.resource.id, type: evidence.resource.type,
        accountId: evidence.resource.accountId, stackId: evidence.resource.stackId,
        serviceId: evidence.resource.serviceId, serviceIds: evidence.resource.serviceIds}});
  },

  draftMatrix: function() {
    return buildPolicyMatrix(this.get('policyDraft'), this.get('capabilityEvidence') || {}, this.matrixLabels(), this.get('matrixNow') || Date.now());
  }.property('policyDraft', 'policyDraft.expiresAt', 'policyDraft.rules.[]', 'capabilityEvidence', 'intl._locale', 'matrixNow'),

  reviewMatrix: function() {
    return buildPolicyMatrix(this.get('review.apiKeyPolicy'), this.get('review.matrixEvidence') || {}, this.matrixLabels(), this.get('matrixNow') || Date.now());
  }.property('review', 'intl._locale', 'matrixNow'),

  matrixExpiryChanged: observer('policyDraft.expiresAt', 'review.apiKeyPolicy.expiresAt', function() {
    this.updateMatrixClock();
  }),

  updateMatrixClock() {
    if ( this._matrixExpiryTimer ) { clearTimeout(this._matrixExpiryTimer); this._matrixExpiryTimer = null; }
    if ( this.isDestroying || this.isDestroyed ) { return; }
    let now = Date.now();
    this.set('matrixNow', now);
    let future = [this.get('policyDraft.expiresAt'), this.get('review.apiKeyPolicy.expiresAt')]
      .map((value) => Date.parse(value)).filter((value) => Number.isFinite(value) && value > now);
    if ( future.length ) {
      // Only wake at the next expiry, not on a polling interval. Long deadlines
      // are capped to the browser's timeout range and re-evaluated on wake.
      this._matrixExpiryTimer = setTimeout(() => {
        this._matrixExpiryTimer = null;
        this.updateMatrixClock();
      }, Math.min(Math.min(...future) - now, 2147483647));
    }
  },

  didReceiveAttrs() {
    this._super(...arguments);
    this.set('clone', this.get('originalModel').clone());
    this.set('model', this.get('originalModel').clone());
    this.resetPolicy();
    if ( this.get('policySupported') ) {
      // Only the new-capability branch needs account preview services. Keep
      // legacy stores/editors independent of these new dependencies.
      this.set('endpoint', this.get('endpoint') || getOwner(this).lookup('service:endpoint'));
      this.set('userStore', this.get('userStore') || getOwner(this).lookup('service:user-store'));
      this.set('session', this.get('session') || getOwner(this).lookup('service:session'));
      this.set('modalService.modalOpts.closeWithOutsideClick', false);
      this.set('modalService.modalOpts.escToClose', false);
    }
  },

  resetPolicy() {
    let policy = initialPolicy(this.get('originalModel.apiKeyPolicy'));
    this.setProperties({
      policyDraft: policy, justCreated: false, review: null, confirmed: false,
      policyError: null, conflict: false, confirmationOptions: null, savedReadback: null,
      capabilityEvidence: {},
      scopeReloadGeneration: this.get('scopeReloadGeneration') + 1,
      expiryChoice: policy.expiresAt ? 'custom' : 'none', expiryLocal: localExpiry(policy.expiresAt),
    });
  },

  draftMetadataChanged: observer('model.name', 'model.description', function() {
    this.invalidateReview();
  }),

  invalidateReview() {
    if ( !this.get('saving') ) {
      this.setProperties({review: null, confirmed: false, policyError: null, confirmationOptions: null});
    }
  },

  policyFailureLabel(failure, fallback) {
    let known = ['OwnerPermissionDenied', 'KeyScopeDenied', 'KeyPolicyDenied', 'ApiKeyExpired', 'ApiKeyRevoked',
      'ApiKeyPolicyChanged', 'PolicyChanged', 'UnknownOperation', 'AuditUnavailable'].includes(failure.code);
    return this.get('intl').t(known ? `apiKeyAudit.reasons.${failure.code}` : fallback);
  },

  didInsertElement() {
    this._super(...arguments);
    this._focusTimer = setTimeout(() => {
      this._focusTimer = null;
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      let inputs = this.$('INPUT[type="text"]');
      let input = inputs && inputs[0];
      if (input) {
        input.focus();
      }
    }, 250);
  },

  willDestroyElement() {
    if ( this._matrixExpiryTimer ) { clearTimeout(this._matrixExpiryTimer); this._matrixExpiryTimer = null; }
    this._createdSecret = null;
    if ( this.get('clone') ) { this.set('clone.secretValue', null); }
    if (this._focusTimer) {
      clearTimeout(this._focusTimer);
      this._focusTimer = null;
    }
    this._super(...arguments);
  },

  willDestroy() {
    if ( this._matrixExpiryTimer ) { clearTimeout(this._matrixExpiryTimer); this._matrixExpiryTimer = null; }
    this._super(...arguments);
  },

  editing: function() {
    return !!this.get('clone.id');
  }.property('clone.id'),

  doneSaving: function(neu) {
    if ( this.get('editing') )
    {
      this.send('cancel');
    }
    else
    {
      this.setProperties({
        justCreated: true,
        clone: this.cloneForCreateDelivery(neu)
      });
    }
  },

  reviewDraft() {
    if ( this.get('reviewDisabled') ) { return; }
    let policy = plain(this.get('policyDraft'));
    let errors = policyErrors(policy);
    if ( errors.length ) {
      this.set('policyError', this.get('intl').t(`apiKeyAccess.errors.${errors[0]}`));
      return;
    }
    if ( policy.mode !== 'custom' ) {
      policy.rules = [];
      policy.defaultEffect = policy.mode === 'full' ? 'allow' : 'deny';
    }
    let scopeLabels = {};
    if ( policy.mode === 'custom' ) {
      for ( let rule of policy.rules ) {
        let evidence = (this.get('capabilityEvidence') || {})[rule.id];
        if ( !selectionMatches(rule.scope, evidence) ) {
          let status = ['chooseType', 'chooseProject', 'chooseStack', 'chooseResource', 'loading', 'empty', 'unavailable', 'unnamed', 'ambiguous', 'loadError'].includes(evidence?.selectionStatus) ? evidence.selectionStatus : 'unavailable';
          this.set('policyError', this.get('intl').t(`apiKeyAccess.selector.${status}`));
          return;
        }
        scopeLabels[rule.id] = rule.scope.kind === 'global' ? this.get('intl').t('apiKeyAccess.scopes.global') : evidence.selectionLabel;
      }
    }
    let snapshot = {
        name: this.get('model.name') || '', description: this.get('model.description') || '',
        apiKeyPolicy: policy, apiKeyPolicyRevision: this.get('originalModel.apiKeyPolicyRevision') || 0, scopeLabels,
    };
    snapshot.matrixEvidence = Object.fromEntries((policy.rules || []).map((rule) => {
      let evidence = (this.get('capabilityEvidence') || {})[rule.id] || {};
      return [rule.id, this.matrixEvidence(evidence)];
    }));
    this.setProperties({saving: true, confirmed: false, policyError: null, review: null});
    let data = {apiKeyPolicy: policy, apiKeyPolicyRevision: snapshot.apiKeyPolicyRevision};
    if ( this.get('originalModel.id') ) { data.apiKeyId = this.get('originalModel.id'); }
    return this.get('userStore').rawRequest({
      url: `${this.get('endpoint.absolute')}v2-beta/apiKeyPolicyPreview`, method: 'POST', data,
    }).then((response) => {
      if ( this.isDestroyed || this.isDestroying ) { return; }
      let body = response.body;
      if ( !body || !/^[0-9a-f]{64}$/.test(body.requestDigest || '') || body.purpose !== 'apiKeyPolicyUpdate' ||
        !body.apiKeyPolicy || !policiesEqual(body.apiKeyPolicy, policy) ||
        Number(body.apiKeyPolicyRevision) !== Number(snapshot.apiKeyPolicyRevision) ||
        (policy.rules || []).some((rule) => JSON.stringify(snapshot.matrixEvidence[rule.id]) !==
          JSON.stringify(this.matrixEvidence((this.get('capabilityEvidence') || {})[rule.id]))) ) {
        throw {code: 'ApiKeyPreviewUnverified'};
      }
      this.set('review', Object.assign(snapshot, {requestDigest: body.requestDigest,
        purpose: body.purpose, confirmationRequired: body.confirmationRequired === true}));
    }).catch((error) => {
      if ( this.isDestroyed || this.isDestroying ) { return; }
      let failure = apiKeyError(error);
      this.setProperties({policyError: this.policyFailureLabel(failure, failure.status === 409 ? 'apiKeyAccess.errors.conflict' : 'apiKeyAccess.errors.review'),
        conflict: failure.status === 409, errorRequestId: failure.requestId});
    }).finally(() => {
      if ( !this.isDestroyed && !this.isDestroying ) { this.set('saving', false); }
    });
  },

  confirmSnapshot(snapshot) {
    this.set('confirmationOptions', {
      purpose: snapshot.purpose, requestDigest: snapshot.requestDigest,
      onComplete: (ticket) => this.submitPolicy(ticket),
      onCancel: () => this.setProperties({confirmationOptions: null, confirmed: false}),
    });
  },

  submitPolicy(confirmation) {
    if ( this._policySaveActive ) { return resolve(); }
    // A confirmation can finish after the reviewed deadline. Re-check the
    // actual clock as well as the timer-driven UI before sending a mutation.
    let deadline = Date.parse(this.get('review.apiKeyPolicy.expiresAt'));
    if ( Number.isFinite(deadline) && deadline <= Date.now() ) {
      this.setProperties({policyError: this.get('intl').t('apiKeyAccess.errors.expiry'), confirmationOptions: null, confirmed: false});
      return resolve();
    }
    if ( !confirmation && this.get('submitDisabled') ) { return resolve(); }
    let snapshot = this.get('review');
    if ( !snapshot ) { return resolve(); }
    if ( snapshot.confirmationRequired && !confirmation ) {
      this.confirmSnapshot(snapshot);
      return resolve();
    }
    let wasEditing = this.get('editing');
    this._policySaveActive = true;
    let copy = this.get('originalModel').clone();
    let payload = {name: snapshot.name, description: snapshot.description,
      apiKeyPolicy: plain(snapshot.apiKeyPolicy), apiKeyPolicyRevision: snapshot.apiKeyPolicyRevision};
    if ( confirmation ) { payload.securityConfirmation = confirmation; }
    let delivery = null;
    let options = {
      method: wasEditing ? 'PUT' : 'POST',
      url: wasEditing ? copy.get('links.self') : 'apikey', data: payload,
    };
    if ( !wasEditing ) {
      let store = copy.get('store');
      let schema = typeof store.getById === 'function' && store.getById('schema', 'apikey');
      let fields = schema && schema.get('store') === store ? schema.get('resourceFields') || {} : {};
      // Preserve the published store's one-time, schema-bound delivery. The
      // server chooses restricted kind from the submitted policy, not owner.
      let type = snapshot.apiKeyPolicy.mode === 'full' && !snapshot.apiKeyPolicy.expiresAt ? 'apikey' : 'apikeyrestricted';
      Object.defineProperty(options, 'createIdentity', {configurable: true,
        value: {type, generation: store.get('generation'), baseUrl: store.get('baseUrl'),
          readOnCreateFields: Object.keys(fields).filter((field) => fields[field].readOnCreateOnly === true)}});
      bindCreateOnlyDelivery(options, (value) => {
        if ( this.isDestroyed || this.isDestroying ) { value.fields = null; }
        else { delivery = value; }
      });
    }
    this.setProperties({saving: true, policyError: null, confirmationOptions: null});
    return resolve().then(() => copy.request(options)).then((saved) => {
      if ( this.isDestroyed || this.isDestroying ) { return; }
      // A POST result may contain a one-time secret. Retain it only in this modal;
      // the verification GET must never recover or expose an existing secret.
      let delivered = !wasEditing && delivery ? cloneCreateOnlyDelivery(saved, delivery) : null;
      let secret = delivered ? delivered.get('secretValue') : saved.get('secretValue');
      if ( delivered ) { delivered.set('secretValue', null); }
      saved.set('secretValue', null);
      this._createdSecret = wasEditing ? null : secret;
      this._createdByThisModal = !wasEditing;
      let metadata = saved.clone();
      metadata.set('secretValue', null);
      this.get('originalModel').merge(metadata);
      this.set('readbackPending', true);
      let store = saved.get('store') || copy.get('store');
      return store.find(saved.get('type') || 'apikey', saved.get('id'), {forceReload: true}).then((readback) => {
        if ( this.isDestroyed || this.isDestroying ) { return; }
        if ( !readback.get('apiKeyPolicy') ||
          Number(readback.get('apiKeyPolicyRevision')) <= Number(snapshot.apiKeyPolicyRevision) ||
          !policiesEqual(readback.get('apiKeyPolicy'), snapshot.apiKeyPolicy) ) {
          throw {code: 'ApiKeyReadbackUnverified'};
        }
        if ( !wasEditing && !secret ) { throw {code: 'ApiKeyCreateDeliveryUnverified'}; }
        this.get('originalModel').merge(readback);
        this.setProperties({
          savedReadback: readback, review: null, confirmed: false, readbackPending: false,
          policyDraft: initialPolicy(readback.get('apiKeyPolicy')),
          clone: readback.clone(),
        });
        if ( !wasEditing ) {
          this.set('clone.secretValue', secret);
          this.set('justCreated', true);
        }
      });
    }).catch((error) => {
      if ( this.isDestroyed || this.isDestroying ) { return; }
      let failure = apiKeyError(error);
      if ( (failure.code === 'MfaConfirmationRequired' || failure.code === 'MfaReauthenticationRequired') &&
        !confirmation && /^[0-9a-f]{64}$/.test(failure.body.requestDigest || '') ) {
        this.confirmSnapshot(Object.assign({}, snapshot, {requestDigest: failure.body.requestDigest,
          purpose: failure.body.purpose || 'apiKeyPolicyUpdate'}));
        return;
      }
      this.setProperties({
        policyError: this.policyFailureLabel(failure, failure.status === 409 ? 'apiKeyAccess.errors.conflict' :
          this.get('readbackPending') ? 'apiKeyAccess.errors.readback' : 'apiKeyAccess.errors.save'),
        conflict: failure.status === 409, review: null, confirmed: false,
      });
      this.set('errorRequestId', failure.requestId);
    }).finally(() => {
      this._policySaveActive = false;
      takeCreateOnlyDelivery(options);
      if ( delivery ) { delivery.fields = null; }
      payload.securityConfirmation = null;
      if ( !this.isDestroyed && !this.isDestroying ) { this.set('saving', false); }
    });
  },

  actions: {
    scopeCapabilities(id, evidence) {
      let rule = (this.get('policyDraft.rules') || []).find((item) => item.id === id);
      if ( rule && evidence.scopeKey === scopeKey(rule.scope) ) {
        if ( this.get('review') && (!selectionMatches(rule.scope, evidence) ||
          JSON.stringify((this.get('review.matrixEvidence') || {})[id]) !== JSON.stringify(this.matrixEvidence(evidence))) ) { this.invalidateReview(); }
        this.set('capabilityEvidence', Object.assign({}, this.get('capabilityEvidence'), {[id]: evidence}));
      }
    },
    selectMode(mode) {
      if ( this.get('editingLocked') || !['full', 'closed', 'custom'].includes(mode) ) { return; }
      this.invalidateReview();
      let rules = this.get('policyDraft.rules') || [];
      let defaultEffect = mode === 'full' ? 'allow' : mode === 'closed' ? 'deny' : this.get('defaultEffect');
      this.set('policyDraft', Object.assign({}, this.get('policyDraft'), {
        // full/closed are backend presets without rules. A base plus exceptions
        // uses custom; switching the base must never discard the exceptions.
        mode: rules.length ? 'custom' : mode, defaultEffect, rules,
      }));
    },
    defaultEffect(event) {
      if ( ['allow', 'deny'].includes(event.target.value) ) {
        this.send('selectMode', event.target.value === 'allow' ? 'full' : 'closed');
      }
    },
    addRule() {
      if ( this.get('editingLocked') ) { return; }
      this.invalidateReview();
      let defaultEffect = this.get('defaultEffect');
      this._ruleSequence = (this._ruleSequence || 0) + 1;
      let ids = (this.get('policyDraft.rules') || []).map((rule) => rule.id);
      let id = `rule-${this._ruleSequence}`;
      while ( ids.includes(id) ) { id = `rule-${++this._ruleSequence}`; }
      this.set('policyDraft', Object.assign({}, this.get('policyDraft'), {
        mode: 'custom', defaultEffect, rules: (this.get('policyDraft.rules') || []).concat({
          id, effect: defaultEffect === 'allow' ? 'deny' : 'allow', scope: {kind: 'stack', resourceId: ''}, operations: ['read'],
        }),
      }));
    },
    removeRule(id) {
      if ( this.get('editingLocked') ) { return; }
      this.invalidateReview();
      let rules = this.get('policyDraft.rules').filter((rule) => rule.id !== id);
      this.set('policyDraft', Object.assign({}, this.get('policyDraft'), {
        rules, mode: rules.length ? 'custom' : this.get('defaultEffect') === 'allow' ? 'full' : 'closed',
      }));
      let evidence = Object.assign({}, this.get('capabilityEvidence'));
      delete evidence[id];
      this.set('capabilityEvidence', evidence);
    },
    ruleField(id, field, event) {
      if ( this.get('editingLocked') ) { return; }
      this.invalidateReview();
      let rules = plain(this.get('policyDraft.rules'));
      let rule = rules.find((item) => item.id === id);
      if ( field === 'kind' ) { rule.scope = {kind: event.target.value}; }
      else if ( field === 'effect' ) { rule.effect = event.target.value; }
      else { rule.scope[field] = event.target.value.trim(); }
      if ( field === 'resourceType' ) { rule.scope.resourceId = ''; }
      this.set('policyDraft.rules', rules);
    },
    ruleOperation(id, operation, event) {
      if ( this.get('editingLocked') ) { return; }
      let rules = plain(this.get('policyDraft.rules'));
      let rule = rules.find((item) => item.id === id);
      let capability = ownerOperationStates(rule.scope, (this.get('capabilityEvidence') || {})[id], this.get('ownerContextKnown')).find((item) => item.operation === operation);
      if ( event.target.checked && rule.effect === 'allow' && capability && capability.unavailable ) { return; }
      this.invalidateReview();
      rule.operations = event.target.checked ? [...new Set(rule.operations.concat(operation))] : rule.operations.filter((item) => item !== operation);
      this.set('policyDraft.rules', rules);
    },
    expiry(choice, event) {
      if ( this.get('editingLocked') ) { return; }
      this.invalidateReview();
      let value = choice === 'select' ? event.target.value : this.get('expiryChoice');
      this.set('expiryChoice', value);
      let iso = value === 'none' ? null : value === 'custom' ? expiryIso(choice === 'date' ? event.target.value : this.get('expiryLocal')) :
        new Date(Date.now() + Number(value) * 86400000).toISOString();
      this.set('policyDraft.expiresAt', iso);
      if ( value === 'custom' && !iso ) { this.set('policyDraft.expiresAt', ''); }
      this.set('expiryLocal', choice === 'date' ? event.target.value : localExpiry(iso));
    },
    reviewPolicy() { this.reviewDraft(); },
    backToDraft() { this.invalidateReview(); },
    submitPolicy() { return this.submitPolicy(null); },
    reloadPolicy() {
      let original = this.get('originalModel');
      this.set('saving', true);
      return original.get('store').find(original.get('type') || 'apikey', original.get('id'), {forceReload: true}).then((key) => {
        original.merge(key);
        this.set('model', key.clone());
        this.resetPolicy();
        this.setProperties({readbackPending: false, savedReadback: key, clone: key.clone()});
        if ( this._createdByThisModal ) {
          this.setProperties({justCreated: true});
          this.set('clone.secretValue', this._createdSecret);
        }
      }).catch(() => this.set('policyError', this.get('intl').t('apiKeyAccess.errors.reload')))
        .finally(() => this.set('saving', false));
    },
    cancel() {
      if ( !this.get('policySupported') || !this.get('saving') ) {
        this.setProperties({review: null, confirmed: false, confirmationOptions: null, policyDraft: null});
        this._createdSecret = null;
        this.get('modalService').toggleModal();
      }
    },
  },

});
