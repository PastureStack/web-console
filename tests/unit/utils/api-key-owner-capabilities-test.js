import { module, test } from 'qunit';
import { API_KEY_ACTION_OPERATIONS, ownerOperationStates, scopeKey } from 'ui/utils/api-key-owner-capabilities';

module('Unit | Utility | API key owner capabilities');
const scope = {kind: 'resource', resourceType: 'container', resourceId: '1i42'};
const schema = {id: 'container', collectionMethods: ['GET'], resourceMethods: ['GET'], resourceActions: {logs: {}}, resourceLinks: []};
function evidence(overrides) {
  return Object.assign({scopeKey: scopeKey(scope), contextVerified: true, complete: true, schemas: [schema],
    resource: {id: '1i42', type: 'container', accountId: '1a9', actionLinks: {logs: '/logs'}, links: {self: '/self'}}}, overrides);
}
function states(value) { return Object.fromEntries(value.map((item) => [item.operation, item.status])); }

test('explicit live API absence disables only unavailable operations, not all cells via canCreate', function(assert) {
  assert.deepEqual(states(ownerOperationStates(scope, evidence(), true)), {
    read: 'observed', create: 'unknown', update: 'unavailable', upgrade: 'unavailable',
    delete: 'unavailable', exec: 'unavailable', logs: 'observed', export: 'unavailable',
  });
});

test('unknown, other owner, stale scope and incomplete metadata never claim grants or denial', function(assert) {
  [null, evidence({complete: false}), evidence({contextVerified: false}), evidence({scopeKey: 'resource:container:other'})]
    .forEach((item) => assert.ok(ownerOperationStates(scope, item, true).every((cell) => cell.status === 'unknown')));
  assert.ok(ownerOperationStates(scope, evidence(), false).every((cell) => cell.status === 'unknown'));
  assert.ok(ownerOperationStates({kind: 'global'}, evidence(), true).every((cell) => cell.status === 'unknown'), 'one project never restricts global/full');
});

test('schema action presence without the selected object action is unknown, not falsely denied', function(assert) {
  let result = ownerOperationStates(scope, evidence({resource: {id: '1i42', type: 'container', links: {self: '/self'}}}), true);
  assert.strictEqual(states(result).logs, 'unknown', 'an object state can temporarily hide a schema-authorized action');
  assert.strictEqual(states(ownerOperationStates(scope, evidence({schemas: [{id: 'container', resourceMethods: ['GET']}]}), true)).exec, 'unknown', 'missing metadata is not an empty permission set');
});

test('stack-wide evidence requires all supported child types and its own project metadata', function(assert) {
  let stack = {kind: 'stack', resourceId: '1st4'};
  let full = {scopeKey: scopeKey(stack), contextVerified: true, complete: true, projectId: '1a9',
    resource: {id: '1st4', accountId: '1a9'}, schemas: ['stack', 'service', 'container', 'volume'].map((id) => Object.assign({}, schema, {id}))};
  assert.strictEqual(states(ownerOperationStates(stack, full, true)).create, 'unavailable');
  assert.strictEqual(states(ownerOperationStates(stack, full, true)).logs, 'observed', 'a child log action is not hidden by the stack object');
  assert.ok(ownerOperationStates(stack, Object.assign({}, full, {projectId: '1aOther'}), true).every((cell) => cell.status === 'unknown'));
  assert.ok(ownerOperationStates(stack, Object.assign({}, full, {schemas: [schema]}), true).every((cell) => cell.status === 'unknown'), 'one type cannot deny an entire stack');
});

test('canonical aliases and real action/link names retain independent operations', function(assert) {
  assert.strictEqual(scopeKey({kind: 'resource', resourceType: 'apiKeyRestricted', resourceId: '1c1'}), scopeKey({kind: 'resource', resourceType: 'apiKey', resourceId: '1c1'}));
  let alias = evidence({schemas: [Object.assign({}, schema, {id: 'instance', resourceActions: {execute: {}, upgrade: {}}, resourceLinks: ['downloadConfig']})],
    resource: {id: '1i42', type: 'instance', actionLinks: {execute: '/exec', upgrade: '/upgrade'}, links: {downloadConfig: '/download'}}});
  let result = states(ownerOperationStates(scope, alias, true));
  assert.strictEqual(result.exec, 'observed'); assert.strictEqual(result.upgrade, 'observed'); assert.strictEqual(result.export, 'observed');
  assert.strictEqual(API_KEY_ACTION_OPERATIONS.cancelrollback, undefined, 'unregistered actions are not presented as supported custom operations');
});
