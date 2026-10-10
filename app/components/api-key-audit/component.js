import Component from '@ember/component';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import { later, cancel } from '@ember/runloop';
import { API_KEY_OPERATIONS, apiKeyError, expiryIso } from 'ui/utils/api-key-policy';

const FILTERS = ['decision', 'outcome', 'httpStatus', 'operation', 'targetType', 'requestId'];
const PHASES = ['decision', 'response', 'attempt', 'continuation', 'completion', 'handshake'];
const TARGET_TYPES = ['stack', 'service', 'container', 'host', 'volume', 'network', 'secret', 'certificate',
  'project', 'setting', 'userPreference', 'registry', 'storagePool', 'networkPolicy', 'projectMember',
  'apiKey', 'apiKeyRestricted', 'account', 'auditLog'];
const REASONS = ['KeyFullAccess', 'KeyRuleAllowed', 'KeyScopedCollection', 'KeyPolicyDenied', 'KeyScopeDenied',
  'OwnerPermissionDenied', 'ApiKeyExpired', 'ApiKeyRevoked', 'ApiKeyPolicyChanged', 'PolicyChanged',
  'UnknownOperation', 'AuthenticationPending', 'AuthenticationDenied', 'authorization_not_completed', 'ApiKeyDelegationLive', 'AuditUnavailable',
  'HandshakeDenied', 'DockerFailure', 'StreamFailed', 'AuthorizationRevoked', 'ClientDisconnected', 'StreamCancelled', 'StreamCompleted', 'DelegationRouteDenied',
  'ApiKeyInactive', 'UNKNOWN_EXCEPTION', 'AUTHORIZATION_DENIED', 'KeyGovernanceCompleted', 'KeyGovernanceDenied',
  'KeyGovernanceFailed', 'ApiKeyRestrictedDelegationUnsupported'];

export default Component.extend({
  userStore: service('user-store'),
  endpoint: service(),
  access: service(),
  intl: service(),
  keyId: null,
  rows: null,
  detail: null,
  total: 0,
  offset: 0,
  limit: 25,
  busy: false,
  error: null,
  timeScope: 'all',
  createdFrom: '',
  createdTo: '',
  operations: API_KEY_OPERATIONS,
  outcomes: ['PENDING', 'AUTHENTICATION_DENIED', 'DENIED', 'NOT_EXECUTED', 'ACCEPTED', 'SUCCEEDED', 'FAILED', 'CANCELED'],

  hasPrevious: function() { return this.get('offset') > 0; }.property('offset'),
  hasNext: function() { return this.get('offset') + this.get('limit') < this.get('total'); }.property('offset', 'limit', 'total'),
  page: function() { return Math.floor(this.get('offset') / this.get('limit')) + 1; }.property('offset', 'limit'),

  didReceiveAttrs() {
    this._super(...arguments);
    if ( this.get('keyId') !== this._targetKey ) {
      this._targetKey = this.get('keyId');
      this.set('offset', 0);
      this.clearRecords();
      this.load();
    }
  },

  viewerChanged: observer('access.identity.id', function() {
    this._generation = (this._generation || 0) + 1;
    this.clearRecords();
    this.set('error', this.get('intl').t('apiKeyAudit.errors.access'));
  }),

  willDestroyElement() {
    cancel(this._timer);
    this._generation = (this._generation || 0) + 1;
    this._super(...arguments);
  },

  clearRecords() {
    this.setProperties({rows: [], detail: null, total: 0});
  },

  query() {
    let params = new URLSearchParams({keyId: this.get('keyId'), timeScope: this.get('timeScope'),
      limit: this.get('limit'), offset: this.get('offset')});
    FILTERS.forEach((field) => {
      let value = this.get(field);
      if ( value ) { params.set(field, String(value).trim()); }
    });
    if ( this.get('timeScope') === 'range' ) {
      let from = expiryIso(this.get('createdFrom'));
      let to = expiryIso(this.get('createdTo'));
      if ( !from || !to || Date.parse(from) > Date.parse(to) ) { throw {code: 'InvalidAuditRange'}; }
      params.set('created_gte', from);
      params.set('created_lte', to);
    }
    return params.toString();
  },

  url() {
    return `${this.get('endpoint.absolute')}v2-beta/pasturestack/key-audit-logs`;
  },

  load() {
    cancel(this._timer);
    let generation = this._generation = (this._generation || 0) + 1;
    this.setProperties({busy: true, error: null});
    // Clear both list and detail before checking current viewer access. A late
    // response from another key/filter/viewer must never repopulate old DOM.
    this.clearRecords();
    if ( !this.get('keyId') ) { this.set('busy', false); return; }
    let query;
    try { query = this.query(); } catch (error) { this.showError(error, generation); return; }
    return this.get('userStore').rawRequest({url: `${this.url()}?${query}`, method: 'GET'}).then((response) => {
      if ( !this.current(generation) ) { return; }
      let body = response.body;
      if ( !body || !Array.isArray(body.data) || body.data.some((record) => record.keyId !== this.get('keyId')) ||
        !body.pagination || body.pagination.total == null || !Number.isSafeInteger(Number(body.pagination.total)) || Number(body.pagination.total) < 0 ) {
        throw {code: 'InvalidAuditResponse'};
      }
      this.setProperties({rows: body.data.map((record) => this.safeRecord(record)), total: Number(body.pagination.total), busy: false});
      this._timer = later(this, this.load, 30000);
    }).catch((error) => this.showError(error, generation));
  },

  current(generation) {
    return generation === this._generation && !this.isDestroyed && !this.isDestroying;
  },

  safeRecord(record) {
    let safe = {};
    ['id', 'keyId', 'created', 'decision', 'outcome', 'httpStatus', 'responseCode', 'requestId', 'actor',
      'targetType', 'targetId', 'operation', 'policyRevision', 'phase'].forEach((field) => {
      let value = record[field];
      safe[field] = typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 256) : '';
    });
    safe.preview = record.preview === true;
    safe.targetLabelKey = TARGET_TYPES.includes(safe.targetType) ?
      `apiKeyAccess.selector.types.${safe.targetType}` : 'apiKeyAudit.unknownTarget';
    safe.operationLabelKey = API_KEY_OPERATIONS.includes(safe.operation) ?
      `apiKeyAccess.operations.${safe.operation}` : 'apiKeyAudit.unknownOperation';
    safe.decisionLabelKey = ['ALLOW', 'DENY'].includes(safe.decision) ?
      `apiKeyAudit.decisions.${safe.decision}` : 'apiKeyAudit.decisions.unknown';
    // A preview may itself finish successfully, but it has not run the requested
    // operation. Render that meaning instead of an execution-success label.
    safe.outcomeLabelKey = safe.preview ? 'apiKeyAudit.preview' :
      safe.outcome === 'SUCCEEDED' && safe.phase === 'response' ? 'apiKeyAudit.responseSucceeded' :
      safe.outcome === 'SUCCEEDED' && safe.phase === 'completion' ? 'apiKeyAudit.completionSucceeded' :
      this.get('outcomes').includes(safe.outcome) ? `apiKeyAudit.outcomes.${safe.outcome}` : 'apiKeyAudit.outcomes.unknown';
    safe.phaseLabelKey = PHASES.includes(safe.phase) ? `apiKeyAudit.phases.${safe.phase}` : 'apiKeyAudit.phases.unknown';
    safe.reason = REASONS.includes(record.reason) ? record.reason : '';
    safe.reasonLabelKey = safe.reason ? `apiKeyAudit.reasons.${safe.reason}` : 'apiKeyAudit.reasons.unknown';
    safe.responseCode = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(safe.responseCode) ? safe.responseCode : '';
    safe.hasHttpResponse = Number(safe.httpStatus) >= 100 && Number(safe.httpStatus) <= 599;
    return safe;
  },

  showError(error, generation) {
    if ( !this.current(generation) ) { return; }
    this.clearRecords();
    let failure = apiKeyError(error);
    this.setProperties({busy: false, error: this.get('intl').t(failure.status === 403 || failure.status === 401 ?
      'apiKeyAudit.errors.access' : failure.status === 404 ? 'apiKeyAudit.errors.missing' : failure.code === 'result_set_too_large' ? 'apiKeyAudit.errors.tooLarge' :
        failure.code === 'InvalidAuditRange' ? 'apiKeyAudit.errors.range' : 'apiKeyAudit.errors.load'), errorRequestId: failure.requestId});
  },

  actions: {
    filter() { this.set('offset', 0); return this.load(); },
    page(direction) {
      if ( this.get('busy') || (direction < 0 && !this.get('hasPrevious')) || (direction > 0 && !this.get('hasNext')) ) { return; }
      this.incrementProperty('offset', direction * this.get('limit'));
      return this.load();
    },
    select(field, event) { this.set(field, event.target.value); },
    details(id) {
      let generation = this._generation = (this._generation || 0) + 1;
      cancel(this._timer);
      this.setProperties({detail: null, busy: true, error: null});
      return this.get('userStore').rawRequest({url: `${this.url()}/${encodeURIComponent(id)}?keyId=${encodeURIComponent(this.get('keyId'))}`, method: 'GET'}).then((response) => {
        if ( !this.current(generation) ) { return; }
        if ( !response.body || response.body.keyId !== this.get('keyId') ) { throw {code: 'InvalidAuditResponse'}; }
        this.setProperties({detail: this.safeRecord(response.body), busy: false});
        this._timer = later(this, this.load, 30000);
      }).catch((error) => this.showError(error, generation));
    },
    closeDetail() { this.set('detail', null); },
  },
});
