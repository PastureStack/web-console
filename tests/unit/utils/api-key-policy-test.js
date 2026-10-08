import { module, test } from 'qunit';
import { API_KEY_OPERATIONS, initialPolicy, policyErrors, policiesEqual, localExpiry, expiryIso, apiKeyError } from 'ui/utils/api-key-policy';

module('Unit | Utility | API key policy');

test('full preserves the principal ceiling without extra restriction and closed needs no grants', function(assert) {
  assert.strictEqual(initialPolicy(null).mode, 'full');
  assert.strictEqual(initialPolicy(null).defaultEffect, 'allow');
  assert.deepEqual(policyErrors({mode: 'full', defaultEffect: 'deny', expiresAt: null}), ['effect']);
  assert.deepEqual(policyErrors({mode: 'closed', expiresAt: null, rules: []}), []);
  assert.deepEqual(API_KEY_OPERATIONS, ['read', 'create', 'update', 'upgrade', 'delete', 'exec', 'logs', 'export']);
});

test('custom rules require stable IDs and independently named operations', function(assert) {
  let policy = {mode: 'custom', defaultEffect: 'deny', rules: [{id: 'r1', effect: 'allow', scope: {kind: 'stack'}, operations: ['read']}]};
  assert.deepEqual(policyErrors(policy), ['scope']);
  policy.rules[0].scope.resourceId = '1s42';
  assert.deepEqual(policyErrors(policy), []);
  policy.rules[0].scope = {kind: 'resource', resourceType: 'unknownType', resourceId: '1s42'};
  assert.deepEqual(policyErrors(policy), ['scope'], 'unknown resource types are not offered or claimed as supported');
  policy.rules[0].scope = {kind: 'stack', resourceId: '1s42'};
  policy.rules[0].operations = ['read', 'run'];
  assert.deepEqual(policyErrors(policy), ['operation']);
  policy.rules.push(Object.assign({}, policy.rules[0]));
  assert.ok(policyErrors(policy).includes('ruleId'));
});

test('expiration rejects blank, invalid, and past dates', function(assert) {
  ['bad', '', '2000-01-01T00:00:00Z'].forEach((expiresAt) => assert.deepEqual(policyErrors({mode: 'full', expiresAt}), ['expiry']));
  assert.deepEqual(policyErrors({mode: 'full', expiresAt: '2100-01-01T00:00:00Z'}), []);
  let date = '2100-01-01T00:00:00.000Z';
  assert.strictEqual(expiryIso(localExpiry(date)), date, 'local input round-trips the same instant');
});

test('fresh readback compares policy meaning without relying on array order', function(assert) {
  let a = {mode: 'custom', defaultEffect: 'deny', expiresAt: null, rules: [{id: 'r1', effect: 'deny', scope: {kind: 'resource', resourceType: 'service', resourceId: '1s42'}, operations: ['logs', 'exec']}]};
  let b = JSON.parse(JSON.stringify(a));
  b.rules[0].operations.reverse();
  assert.ok(policiesEqual(a, b));
  b.rules[0].effect = 'allow';
  assert.notOk(policiesEqual(a, b), 'a server-side change is not called a verified save');
  a.rules[0].scope.resourceType = 'apiKeyRestricted';
  b = JSON.parse(JSON.stringify(a));
  b.rules[0].scope.resourceType = 'apiKey';
  assert.ok(policiesEqual(a, b), 'credential subtypes use the same canonical scope resource type as the server');
});

test('errors expose bounded API identifiers, never response HTML or arbitrary text', function(assert) {
  let error = apiKeyError({status: 403, body: '<script>secret</script>', code: '<img onerror=secret>'});
  assert.strictEqual(error.code, null);
  assert.strictEqual(error.requestId, null);
  assert.strictEqual(apiKeyError({body: {code: 'PolicyConflict', requestId: 'request-123', status: 409}}).requestId, 'request-123');
});
