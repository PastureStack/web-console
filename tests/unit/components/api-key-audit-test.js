import EmberObject from '@ember/object';
import { resolve, reject, defer } from 'rsvp';
import { module, test } from 'qunit';
import ApiKeyAudit from 'ui/components/api-key-audit/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | API key audit');

function audit(rawRequest) {
  return createOwned(ApiKeyAudit, {renderer: inertRenderer(), keyId: '1a1',
    userStore: EmberObject.create({rawRequest}), endpoint: EmberObject.create({absolute: 'https://platform.example/'}),
    intl: EmberObject.create({t(value) { return value; }}), access: EmberObject.create({identity: {id: 'viewer'}}),
  }, 'component');
}

test('query scopes by stable target key and applies filters before pagination', function(assert) {
  let component = audit(() => resolve());
  component.setProperties({requestId: 'request-id', operation: 'logs', offset: 25});
  let params = new URLSearchParams(component.query());
  assert.strictEqual(params.get('keyId'), '1a1');
  assert.strictEqual(params.get('timeScope'), 'all', 'canonical all-time contract has no hidden 24-hour limit');
  assert.notOk(params.has('timescope'), 'the early lowercase alias is not emitted');
  assert.strictEqual(params.get('requestId'), 'request-id');
  assert.strictEqual(params.get('offset'), '25');
  assert.strictEqual(params.get('operation'), 'logs');
  component.set('outcome', 'PENDING');
  assert.strictEqual(new URLSearchParams(component.query()).get('outcome'), 'PENDING', 'pending decisions can be filtered');
  component.setProperties({timeScope: 'range', createdFrom: '2030-01-01T00:00', createdTo: '2030-01-02T00:00'});
  params = new URLSearchParams(component.query());
  assert.strictEqual(params.get('timeScope'), 'range');
  assert.ok(params.has('created_gte') && params.has('created_lte'), 'range emits the real date bounds');
  destroyOwned(component);
});

test('authorization loss clears old list, detail, and count', async function(assert) {
  let component = audit(() => reject({status: 403, body: {code: 'key_audit_access_lost'}}));
  component.setProperties({rows: [{id: 'old'}], detail: {id: 'old'}, total: 100});
  await component.load();
  assert.deepEqual(component.get('rows'), []);
  assert.strictEqual(component.get('detail'), null);
  assert.strictEqual(component.get('total'), 0);
  assert.strictEqual(component.get('error'), 'apiKeyAudit.errors.access');
  destroyOwned(component);
});

test('a late response from a previous key cannot repopulate DOM', async function(assert) {
  let pending = defer();
  let component = audit(() => pending.promise);
  let load = component.load();
  component.set('access.identity.id', 'another-viewer');
  pending.resolve({body: {data: [{id: 'old', keyId: '1a1'}], pagination: {total: 1}}});
  await load;
  assert.deepEqual(component.get('rows'), []);
  assert.strictEqual(component.get('total'), 0);
  destroyOwned(component);
});

test('ALLOW and HTTP 202 remain distinct from a completed outcome; secrets are not rendered', function(assert) {
  let component = audit(() => resolve());
  let record = component.safeRecord({id: 'event', keyId: '1a1', decision: 'ALLOW', outcome: 'ACCEPTED', httpStatus: 202,
    requestId: 'request', secretValue: 'secret', requestBody: {password: 'secret'}, authorization: 'Basic secret'});
  assert.strictEqual(record.decision, 'ALLOW');
  assert.strictEqual(record.outcome, 'ACCEPTED');
  assert.strictEqual(record.httpStatus, '202');
  assert.ok(record.hasHttpResponse);
  assert.notOk(component.safeRecord({httpStatus: 0, phase: 'completion'}).hasHttpResponse, 'background completion never fabricates an HTTP response');
  assert.strictEqual(component.safeRecord({httpStatus: 200, outcome: 'CANCELED'}).outcomeLabelKey, 'apiKeyAudit.outcomes.CANCELED', 'a streamed HTTP 200 can still be interrupted');
  assert.strictEqual(component.safeRecord({httpStatus: 200, outcome: 'ACCEPTED'}).outcomeLabelKey, 'apiKeyAudit.outcomes.ACCEPTED', 'mint acceptance is not completion, even with HTTP 200');
  assert.strictEqual(component.safeRecord({preview: true, outcome: 'SUCCEEDED', reason: 'KeyRuleAllowed'}).outcomeLabelKey,
    'apiKeyAudit.preview', 'a successful permission check has not executed the operation');
  assert.strictEqual(component.safeRecord({reason: 'OwnerPermissionDenied'}).reasonLabelKey, 'apiKeyAudit.reasons.OwnerPermissionDenied');
  assert.strictEqual(component.safeRecord({reason: 'KeyScopeDenied'}).reason, 'KeyScopeDenied', 'known safe denial code is retained');
  assert.strictEqual(component.safeRecord({decision: 'ALLOW', phase: 'decision', httpStatus: 0, outcome: 'PENDING'}).outcomeLabelKey,
    'apiKeyAudit.outcomes.PENDING', 'admission has not executed or finished the operation');
  assert.strictEqual(component.safeRecord({decision: 'DENY', outcome: 'AUTHENTICATION_DENIED', reason: 'AuthenticationDenied'}).outcomeLabelKey,
    'apiKeyAudit.outcomes.AUTHENTICATION_DENIED', 'authentication denial is an actual backend outcome');
  ['AuthenticationDenied', 'HandshakeDenied', 'DockerFailure', 'StreamFailed', 'AuthorizationRevoked',
    'ClientDisconnected', 'StreamCancelled', 'StreamCompleted', 'AuditUnavailable'].forEach((reason) => {
    let completion = component.safeRecord({phase: 'completion', httpStatus: 0, outcome: 'FAILED', reason});
    assert.strictEqual(completion.reasonLabelKey, `apiKeyAudit.reasons.${reason}`, 'real stable reason receives safe human wording');
    assert.notOk(completion.hasHttpResponse, 'background reasons never invent HTTP success');
  });
  let routeDenied = component.safeRecord({decision: 'DENY', phase: 'handshake', httpStatus: 403,
    outcome: 'FAILED', reason: 'DelegationRouteDenied', message: 'private upstream message'});
  assert.strictEqual(routeDenied.reasonLabelKey, 'apiKeyAudit.reasons.DelegationRouteDenied', 'a ticket route denial has safe human wording');
  assert.strictEqual(routeDenied.decision, 'DENY', 'using a signed ticket for the wrong route is a separate denied handshake');
  assert.strictEqual(routeDenied.outcomeLabelKey, 'apiKeyAudit.outcomes.FAILED', 'the actual denied handshake failed without changing the earlier ALLOW ticket mint');
  assert.strictEqual(routeDenied.httpStatus, '403', 'the actual route denial status remains distinct from ticket admission');
  assert.notOk('message' in routeDenied, 'private route-denial messages are never copied to the displayed record');
  let unknown = component.safeRecord({reason: 'UnknownFutureReason', message: 'password=secret', responseCode: 'upstream secret message'});
  assert.strictEqual(unknown.reasonLabelKey, 'apiKeyAudit.reasons.unknown');
  assert.strictEqual(unknown.reason, '', 'unknown reasons use human-safe fallback, not backend text');
  assert.strictEqual(unknown.responseCode, '', 'arbitrary backend messages are not response codes');
  assert.notOk('message' in unknown);
  assert.notOk('secretValue' in record);
  assert.notOk('requestBody' in record);
  assert.notOk('authorization' in record);
  destroyOwned(component);
});

test('bounded scan rejection offers a narrower query rather than a partial count', async function(assert) {
  let component = audit(() => reject({status: 422, body: {code: 'result_set_too_large'}}));
  await component.load();
  assert.strictEqual(component.get('error'), 'apiKeyAudit.errors.tooLarge');
  assert.strictEqual(component.get('total'), 0);
  assert.deepEqual(component.get('rows'), []);
  destroyOwned(component);
});

test('actual inactive governance and background reasons use fixed safe labels without changing outcomes', function(assert) {
  let component = audit(() => resolve());
  ['ApiKeyInactive', 'UNKNOWN_EXCEPTION', 'AUTHORIZATION_DENIED', 'KeyGovernanceCompleted', 'KeyGovernanceDenied',
    'KeyGovernanceFailed', 'ApiKeyRestrictedDelegationUnsupported'].forEach((reason) => {
    let record = component.safeRecord({reason, phase: 'attempt', outcome: 'FAILED', httpStatus: 0,
      message: 'private exception or credential', exception: {message: 'private'}, requestBody: {password: 'private'}});
    assert.strictEqual(record.reasonLabelKey, `apiKeyAudit.reasons.${reason}`, 'only the actual stable constant selects its translation');
    assert.strictEqual(record.reason, reason);
    assert.strictEqual(record.outcomeLabelKey, 'apiKeyAudit.outcomes.FAILED', 'a human reason never changes the actual failure outcome');
    assert.notOk(record.hasHttpResponse, 'background events do not fabricate an HTTP response');
    assert.notOk('message' in record || 'exception' in record || 'requestBody' in record, 'private backend details remain absent');
  });
  let accepted = component.safeRecord({reason: 'KeyGovernanceCompleted', phase: 'response', outcome: 'ACCEPTED', httpStatus: 202});
  assert.strictEqual(accepted.outcomeLabelKey, 'apiKeyAudit.outcomes.ACCEPTED', 'processed governance is not a completed lifecycle');
  assert.strictEqual(component.safeRecord({reason: 'UNKNOWN_EXCEPTION private data'}).reasonLabelKey,
    'apiKeyAudit.reasons.unknown', 'a known prefix does not whitelist arbitrary exception strings');
  destroyOwned(component);
});

test('HTTP success and background completion have separate safe phase labels', function(assert) {
  let component = audit(() => resolve());
  let response = component.safeRecord({requestId: 'same-request', phase: 'response', outcome: 'SUCCEEDED', httpStatus: 201});
  let background = component.safeRecord({requestId: 'same-request', phase: 'attempt', outcome: 'FAILED', httpStatus: 0});
  assert.strictEqual(response.phaseLabelKey, 'apiKeyAudit.phases.response');
  assert.strictEqual(response.outcomeLabelKey, 'apiKeyAudit.responseSucceeded', 'HTTP 201 does not claim background completion');
  assert.strictEqual(background.phaseLabelKey, 'apiKeyAudit.phases.attempt');
  assert.strictEqual(background.outcomeLabelKey, 'apiKeyAudit.outcomes.FAILED', 'the same request can have an actual later process failure');
  assert.strictEqual(component.safeRecord({phase: 'completion', outcome: 'SUCCEEDED', httpStatus: 0}).outcomeLabelKey,
    'apiKeyAudit.completionSucceeded', 'only a successful completion receipt claims completed work');
  ['decision', 'response', 'attempt', 'continuation', 'completion', 'handshake'].forEach((phase) => {
    assert.strictEqual(component.safeRecord({phase}).phaseLabelKey, `apiKeyAudit.phases.${phase}`);
  });
  let unknown = component.safeRecord({phase: 'completion private-message', outcome: 'SUCCEEDED', httpStatus: 201});
  assert.strictEqual(unknown.phaseLabelKey, 'apiKeyAudit.phases.unknown', 'only exact actual phases select human labels');
  assert.strictEqual(unknown.outcomeLabelKey, 'apiKeyAudit.outcomes.SUCCEEDED', 'unknown phase never masquerades as completion');
  assert.strictEqual(component.safeRecord({preview: true, phase: 'completion', outcome: 'SUCCEEDED'}).outcomeLabelKey,
    'apiKeyAudit.preview', 'a completed permission preview still has not executed the requested operation');
  destroyOwned(component);
});
