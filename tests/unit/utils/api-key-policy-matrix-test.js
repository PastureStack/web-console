import { module, test } from 'qunit';
import { API_KEY_OPERATIONS } from 'ui/utils/api-key-policy';
import { scopeKey } from 'ui/utils/api-key-owner-capabilities';
import { buildPolicyMatrix, POLICY_MATRIX_BASIS, POLICY_MATRIX_STATES } from 'ui/utils/api-key-policy-matrix';

module('Unit | Utility | API key policy matrix');

const labels = {default: 'Outside selected scopes', global: 'All resources', unverified: 'Select a verified named target'};
const global = () => ({kind: 'global'});
const project = (id = 'project-a') => ({kind: 'project', resourceId: id});
const stack = (id = 'stack-a') => ({kind: 'stack', resourceId: id});
const resource = (resourceType = 'service', resourceId = 'service-a') => ({kind: 'resource', resourceType, resourceId});
const rule = (id, effect, scope, operations = ['read']) => ({id, effect, scope, operations});
const custom = (defaultEffect, rules = []) => ({mode: 'custom', defaultEffect, rules});

function proof(scope, {label = 'Production / App', projectId = 'project-a', stackId = 'stack-a', type, ...changes} = {}) {
  let resourceType = scope.kind === 'resource' ? scope.resourceType : scope.kind;
  return {scopeKey: scopeKey(scope), selectionValid: true, contextVerified: true, complete: true, selectionLabel: label,
    stackContextStatus: ['container', 'instance'].includes(resourceType) ? 'verified' : undefined,
    projectId, stackId: resourceType === 'project' ? null : stackId,
    resource: {id: scope.resourceId, type: type || resourceType, accountId: projectId,
      stackId: resourceType === 'stack' || resourceType === 'environment' ? null : resourceType === 'project' ? null : stackId}, ...changes};
}

function matrix(policy, evidence = {}) { return buildPolicyMatrix(policy, evidence, labels); }
function cell(value, key, operation = 'read') { return value.rows.find((row) => row.key === key).cells.find((item) => item.operation === operation); }
function key(scope) { return `scope:${scopeKey(scope)}`; }

test('eight named operations, safe rendering keys and explicit non-effective boundary', function(assert) {
  let result = matrix(custom('deny'));
  assert.deepEqual(result.operations, API_KEY_OPERATIONS);
  assert.strictEqual(result.rows[0].cells.length, 8);
  assert.strictEqual(result.kind, 'policy-intent');
  assert.strictEqual(result.effectiveAccess, false);
  assert.deepEqual(result.limits, ['liveOwnerRbac', 'expiry', 'createDestinations', 'multipleTargets']);
  assert.strictEqual(result.rows[0].key, 'default');
  assert.strictEqual(result.rows[0].label, labels.default);
});

test('full and closed ignore inactive custom drafts, and have no invented owner grant', function(assert) {
  let stale = [rule('old', 'deny', global(), API_KEY_OPERATIONS)];
  let full = matrix({mode: 'full', defaultEffect: 'allow', rules: stale});
  assert.strictEqual(full.rows.length, 1);
  assert.ok(full.rows[0].cells.every((item) => item.state === 'allow' && item.basis === 'full'));
  assert.strictEqual(full.effectiveAccess, false);
  let closed = matrix({mode: 'closed', defaultEffect: 'deny', rules: [rule('old', 'allow', global())]});
  assert.ok(closed.rows[0].cells.every((item) => item.state === 'deny' && item.basis === 'closed'));
});

test('white and black list defaults differ without becoming an explicit DENY rule', function(assert) {
  assert.strictEqual(cell(matrix(custom('deny')), 'default').basis, 'defaultDeny');
  assert.strictEqual(cell(matrix(custom('allow')), 'default').state, 'allow');
  assert.strictEqual(cell(matrix(custom('allow')), 'default').basis, 'defaultAllow');
  let scope = stack();
  let value = matrix(custom('deny', [rule('allow', 'allow', scope)]), {allow: proof(scope)});
  assert.strictEqual(cell(value, key(scope)).state, 'allow');
  assert.strictEqual(cell(value, key(scope)).basis, 'ruleAllow');
  assert.strictEqual(cell(value, 'default').state, 'deny');
});

test('global rules still apply to the row outside selected specific scopes', function(assert) {
  let value = matrix(custom('deny', [rule('global', 'allow', global())]));
  assert.strictEqual(cell(value, 'default').state, 'allow');
  assert.strictEqual(cell(value, key(global())).state, 'allow');
  assert.strictEqual(value.rows[1].label, labels.global);
  assert.deepEqual(value.rows.map((row) => row.key), ['default', key(global())]);
});

test('explicit global DENY beats a narrower ALLOW in both rule orders', function(assert) {
  let scope = resource();
  let rules = [rule('deny', 'deny', global()), rule('allow', 'allow', scope)];
  [rules, rules.slice().reverse()].forEach((ordered) => {
    let value = matrix(custom('allow', ordered), {allow: proof(scope)});
    assert.ok(value.rows.every((row) => cell(value, row.key).state === 'deny'));
    assert.ok(value.rows.every((row) => cell(value, row.key).basis === 'explicitDeny'));
  });
});

test('a child resource DENY makes its parent mixed, never wholly denied', function(assert) {
  let parent = project(), child = resource();
  let value = matrix(custom('deny', [rule('parent', 'allow', parent), rule('child', 'deny', child)]),
    {parent: proof(parent, {label: 'Production'}), child: proof(child)});
  assert.strictEqual(cell(value, key(parent)).state, 'mixed');
  assert.strictEqual(cell(value, key(parent)).basis, 'scopeExceptions');
  assert.strictEqual(cell(value, key(child)).state, 'deny');
  assert.strictEqual(cell(value, 'default').state, 'deny');
});

test('a narrow ALLOW under default deny makes a selected parent mixed', function(assert) {
  let parent = project(), child = stack();
  let value = matrix(custom('deny', [rule('parent', 'allow', parent, ['update']), rule('child', 'allow', child)]),
    {parent: proof(parent, {label: 'Production'}), child: proof(child)});
  assert.strictEqual(cell(value, key(parent)).state, 'mixed');
  assert.strictEqual(cell(value, key(child)).state, 'allow');
});

test('scope-wide DENY masks nested exceptions rather than creating false mixed results', function(assert) {
  let parent = project(), child = resource();
  let value = matrix(custom('allow', [rule('parent', 'deny', parent), rule('child', 'allow', child)]),
    {parent: proof(parent, {label: 'Production'}), child: proof(child)});
  assert.strictEqual(cell(value, key(parent)).state, 'deny');
  assert.strictEqual(cell(value, key(child)).state, 'deny');
});

test('verified project, stack and resource overlaps accumulate but DENY always wins', function(assert) {
  let p = project(), st = stack(), item = resource();
  let value = matrix(custom('deny', [rule('p', 'allow', p), rule('st', 'deny', st), rule('item', 'allow', item)]),
    {p: proof(p, {label: 'Production'}), st: proof(st), item: proof(item, {label: 'Production / App / Web'})});
  assert.strictEqual(cell(value, key(p)).state, 'mixed');
  assert.strictEqual(cell(value, key(st)).state, 'deny');
  assert.strictEqual(cell(value, key(item)).state, 'deny');
});

test('different verified projects are disjoint even when human names coincide', function(assert) {
  let p = project(), other = stack('stack-b');
  let value = matrix(custom('allow', [rule('p', 'deny', p), rule('other', 'allow', other)]),
    {p: proof(p, {label: 'Production'}), other: proof(other, {projectId: 'project-b', stackId: 'stack-b'})});
  assert.strictEqual(cell(value, key(p)).state, 'deny');
  assert.strictEqual(cell(value, key(other)).state, 'allow');
  assert.strictEqual(new Set(value.rows.map((row) => row.key)).size, value.rows.length);
});

test('exact Service scope never grants or denies an attached Container by itself', function(assert) {
  let service = resource(), container = resource('container', 'container-a');
  let value = matrix(custom('deny', [rule('service', 'allow', service), rule('container', 'allow', container, ['logs'])]),
    {service: proof(service), container: proof(container, {label: 'Production / App / Worker',
      resource: {id: 'container-a', type: 'container', accountId: 'project-a', stackId: 'stack-a', serviceIds: ['service-a']}})});
  assert.strictEqual(cell(value, key(service)).state, 'allow');
  assert.strictEqual(cell(value, key(container)).state, 'deny');
  value = matrix(custom('allow', [rule('service', 'deny', service), rule('container', 'allow', container, ['logs'])]),
    {service: proof(service), container: proof(container, {label: 'Production / App / Worker'})});
  assert.strictEqual(cell(value, key(container)).state, 'allow');
});

test('resource type and ID are both required; different exact resources do not overlap', function(assert) {
  let a = resource('service', 'shared-id'), b = resource('container', 'shared-id');
  let value = matrix(custom('deny', [rule('a', 'allow', a), rule('b', 'allow', b, ['logs'])]), {a: proof(a), b: proof(b)});
  assert.strictEqual(cell(value, key(a)).state, 'allow');
  assert.strictEqual(cell(value, key(b)).state, 'deny');
});

test('Stack and Project exact objects belong to their own ancestry scopes', function(assert) {
  let st = stack(), exactStack = resource('stack', 'stack-a');
  let value = matrix(custom('allow', [rule('st', 'deny', st), rule('exact', 'allow', exactStack)]),
    {st: proof(st), exact: proof(exactStack)});
  assert.strictEqual(cell(value, key(exactStack)).state, 'deny');
  let p = project(), exactProject = resource('project', 'project-a');
  value = matrix(custom('allow', [rule('p', 'deny', p), rule('exact', 'allow', exactProject)]),
    {p: proof(p, {label: 'Production'}), exact: proof(exactProject, {label: 'Production'})});
  assert.strictEqual(cell(value, key(exactProject)).state, 'deny');
});

test('aliases use the existing canonical policy types and coalesce the same chosen scope', function(assert) {
  let alias = resource('instance', 'container-a'), canonical = resource('container', 'container-a');
  let value = matrix(custom('deny', [rule('alias', 'allow', alias), rule('deny', 'deny', canonical)]),
    {alias: proof(alias), deny: proof(canonical)});
  assert.strictEqual(value.rows.length, 2);
  assert.strictEqual(cell(value, key(canonical)).state, 'deny');
  let apiKey = resource('apiKeyRestricted', 'key-a');
  value = matrix(custom('allow', [rule('key', 'deny', apiKey)]), {key: proof(apiKey, {projectId: null, stackId: null})});
  assert.strictEqual(cell(value, key(apiKey)).state, 'deny');
});

test('project-only Host cannot be treated as a Stack child from missing fields', function(assert) {
  let st = stack(), host = resource('host', 'host-a');
  let value = matrix(custom('allow', [rule('st', 'deny', st), rule('host', 'allow', host)]),
    {st: proof(st), host: proof(host, {stackId: null})});
  assert.strictEqual(cell(value, key(host)).state, 'allow');
  assert.strictEqual(cell(value, key(st)).state, 'deny');
});

test('platform Setting does not inherit an unrelated project scope', function(assert) {
  let p = project(), setting = resource('setting', 'setting-name');
  let value = matrix(custom('allow', [rule('p', 'deny', p), rule('setting', 'allow', setting)]),
    {p: proof(p, {label: 'Production'}), setting: proof(setting, {projectId: null, stackId: null})});
  assert.strictEqual(cell(value, key(setting)).state, 'allow');
});

test('fresh schema types use internal case and aliases without rewriting wire policy DTOs', function(assert) {
  ['apiKey', 'apiKeyRestricted', 'userPreference', 'auditLog', 'networkPolicy', 'storagePool', 'projectMember'].forEach((resourceType) => {
    let scope = resource(resourceType, `${resourceType}-a`);
    let isPlatform = ['apiKey', 'apiKeyRestricted', 'userPreference', 'auditLog'].includes(resourceType);
    let policy = custom('deny', [rule('item', 'allow', scope)]);
    let evidence = proof(scope, {type: resourceType.toLowerCase(), stackId: null, projectId: isPlatform ? null : 'project-a'});
    assert.strictEqual(cell(matrix(policy, {item: evidence}), key(scope)).state, 'allow', resourceType);
    assert.strictEqual(policy.rules[0].scope.resourceType, resourceType, 'wire type is retained');
  });
});

test('Account without project-kind proof keeps parent matching unknown', function(assert) {
  let p = project(), account = resource('account', 'account-a');
  let value = matrix(custom('allow', [rule('p', 'deny', p), rule('account', 'allow', account)]),
    {p: proof(p, {label: 'Production'}), account: proof(account, {projectId: null, stackId: null})});
  assert.strictEqual(cell(value, key(account)).state, 'unknown');
  assert.strictEqual(cell(value, key(account)).basis, 'unknownOverlap');
});

test('missing ancestry is unknown, never an invented no-parent or first serviceIds parent', function(assert) {
  let st = stack(), child = resource('container', 'container-a');
  let value = matrix(custom('allow', [rule('st', 'deny', st), rule('child', 'allow', child)]),
    {st: proof(st), child: proof(child, {stackId: null, stackContextStatus: 'unknown',
      resource: {id: 'container-a', type: 'container', accountId: 'project-a', serviceIds: ['service-a', 'service-b']}})});
  assert.strictEqual(cell(value, key(child)).state, 'unknown');
  assert.strictEqual(cell(value, key(child)).basis, 'unknownEvidence');
  value = matrix(custom('deny', [rule('child', 'allow', child)]), {child: proof(child, {projectId: null, stackId: null,
    resource: {id: 'container-a', type: 'container'}})});
  assert.strictEqual(cell(value, key(child)).basis, 'unknownEvidence');
});

test('fresh selector-derived stackId supports containers whose raw direct stackId is absent', function(assert) {
  let st = stack(), child = resource('container', 'container-a');
  let value = matrix(custom('allow', [rule('st', 'deny', st), rule('child', 'allow', child)]),
    {st: proof(st), child: proof(child, {resource: {id: 'container-a', type: 'container', accountId: 'project-a', serviceIds: ['service-a']}})});
  assert.strictEqual(cell(value, key(child)).state, 'deny');
});

test('Container parent proof is three-state, never two copies of an unverified direct Stack', function(assert) {
  let st = stack('stack-b'), child = resource('container', 'container-a');
  let policy = custom('allow', [rule('st', 'deny', st), rule('child', 'allow', child, ['logs'])]);
  ['unknown', undefined].forEach((stackContextStatus) => {
    let value = matrix(policy, {st: proof(st, {stackId: 'stack-b'}), child: proof(child, {stackContextStatus})});
    assert.strictEqual(cell(value, key(child)).state, 'unknown', String(stackContextStatus));
    assert.strictEqual(cell(value, key(child)).basis, 'unknownEvidence');
  });
  let conflicting = matrix(policy, {st: proof(st, {stackId: 'stack-b'}), child: proof(child, {stackContextStatus: 'conflicting'})});
  assert.strictEqual(cell(conflicting, key(child)).basis, 'unknownEvidence');
  let noStack = matrix(policy, {st: proof(st, {stackId: 'stack-b'}), child: proof(child, {stackId: null, stackContextStatus: 'verified'})});
  assert.strictEqual(cell(noStack, key(child)).state, 'allow', 'verified null Stack is disjoint, not guessed');
  let unprovenExact = matrix(custom('allow', [rule('child', 'allow', child)]), {child: proof(child, {stackContextStatus: 'unknown'})});
  assert.strictEqual(cell(unprovenExact, key(child)).basis, 'unknownEvidence', 'no Stack rule does not excuse an unresolved target');
  [undefined, '', ' ', false].forEach((stackId) => {
    // Override after construction: the fixture's default parameter deliberately
    // supplies a valid Stack when the caller omits stackId.
    let malformed = matrix(policy, {st: proof(st, {stackId: 'stack-b'}),
      child: Object.assign(proof(child, {stackContextStatus: 'verified'}), {stackId})});
    assert.strictEqual(cell(malformed, key(child)).basis, 'unknownEvidence', `verified does not repair ${String(stackId)}`);
  });
  let contradiction = matrix(policy, {st: proof(st, {stackId: 'stack-b'}), child: proof(child, {stackId: null,
    stackContextStatus: 'verified', resource: {id: 'container-a', type: 'container', accountId: 'project-a', stackId: 'stack-a'}})});
  assert.strictEqual(cell(contradiction, key(child)).basis, 'unknownEvidence', 'verified null cannot mask a positive direct Stack');
});

test('fresh verified null Stack proves legal project-level Service and Volume targets', function(assert) {
  let st = stack();
  ['service', 'volume'].forEach((resourceType) => {
    let child = resource(resourceType, `${resourceType}-a`);
    let value = matrix(custom('allow', [rule('st', 'deny', st), rule('child', 'allow', child)]),
      {st: proof(st), child: proof(child, {stackId: null, stackContextStatus: 'verified'})});
    assert.strictEqual(cell(value, key(child)).state, 'allow', resourceType);
    assert.strictEqual(cell(value, key(st)).state, 'deny', 'no fake inheritance from an unrelated Stack');
    let unproven = matrix(custom('allow', [rule('st', 'deny', st), rule('child', 'allow', child)]),
      {st: proof(st), child: proof(child, {stackId: null})});
    assert.strictEqual(cell(unproven, key(child)).basis, 'unknownOverlap', 'missing proof remains conservative');
  });
});

test('stale, loading, incomplete, mismatched or unnamed selections stay unknown with no ID fallback', function(assert) {
  let scope = resource();
  [{selectionValid: false}, {contextVerified: false}, {complete: false}, {scopeKey: 'wrong'},
    {selectionLabel: ''}, {selectionLabel: scope.resourceId}, {resource: {id: 'different', type: 'service'}}].forEach((change) => {
    let value = matrix(custom('allow', [rule('item', 'allow', scope)]), {item: proof(scope, change)});
    let row = value.rows[1];
    assert.strictEqual(row.label, labels.unverified);
    assert.ok(row.cells.every((item) => item.state === 'unknown' && item.basis === 'unknownEvidence'));
    assert.notOk(row.label.includes(scope.resourceId));
  });
});

test('conflicting fresh labels or ancestry for duplicate scopes never select the first proof', function(assert) {
  let scope = resource();
  [{label: 'Renamed'}, {projectId: 'project-b'}, {stackId: 'stack-b'}].forEach((change) => {
    let value = matrix(custom('deny', [rule('one', 'allow', scope), rule('two', 'deny', scope)]),
      {one: proof(scope), two: proof(scope, change)});
    assert.strictEqual(value.rows.length, 2);
    assert.strictEqual(value.rows[1].label, labels.unverified);
    assert.strictEqual(cell(value, key(scope)).state, 'unknown');
  });
});

test('duplicate known null and non-null parents stay unknown in both proof orders', function(assert) {
  let scope = resource('container', 'container-a');
  let noStack = proof(scope, {stackId: null, stackContextStatus: 'verified'});
  let inStack = proof(scope, {stackId: 'stack-a', stackContextStatus: 'verified'});
  [[noStack, inStack], [inStack, noStack]].forEach(([one, two]) => {
    let value = matrix(custom('allow', [rule('one', 'allow', scope), rule('two', 'deny', scope)]), {one, two});
    let row = value.rows[1];
    assert.strictEqual(row.label, labels.unverified);
    assert.ok(row.cells.every((item) => item.state === 'unknown' && item.basis === 'unknownEvidence'),
      'verified null is an exact no-parent value, never a wildcard');
  });
  let matching = matrix(custom('deny', [rule('one', 'allow', scope), rule('two', 'allow', scope)]),
    {one: noStack, two: proof(scope, {stackId: null, stackContextStatus: 'verified'})});
  assert.strictEqual(cell(matching, key(scope)).state, 'allow', 'matching verified null proofs are still usable');
});

test('duplicate unknown and known parent states stay unknown in both proof orders', function(assert) {
  let scope = resource('service', 'service-a');
  let unknown = proof(scope, {stackId: null, stackContextStatus: 'unknown'});
  let known = proof(scope, {stackId: 'stack-a', stackContextStatus: 'verified'});
  [[unknown, known], [known, unknown]].forEach(([one, two]) => {
    let value = matrix(custom('deny', [rule('one', 'allow', scope), rule('two', 'deny', scope)]), {one, two});
    assert.strictEqual(value.rows[1].label, labels.unverified);
    assert.ok(value.rows[1].cells.every((item) => item.state === 'unknown' && item.basis === 'unknownEvidence'),
      'a known parent must not absorb a duplicate unknown proof');
  });
});

test('contradictory direct and selector stack evidence is not trusted', function(assert) {
  let scope = resource();
  let value = matrix(custom('allow', [rule('item', 'allow', scope)]), {item: proof(scope, {
    resource: {id: 'service-a', type: 'service', accountId: 'project-a', stackId: 'stack-b'}})});
  assert.strictEqual(cell(value, key(scope)).basis, 'unknownEvidence');
});

test('operations are independent and write intent is conditional on real destinations and all targets', function(assert) {
  let scope = resource();
  let value = matrix(custom('deny', [rule('item', 'allow', scope, ['read', 'create', 'update', 'upgrade', 'delete'])]), {item: proof(scope)});
  assert.strictEqual(cell(value, key(scope)).state, 'allow');
  assert.deepEqual(cell(value, key(scope), 'create'), {operation: 'create', policyState: 'allow', state: 'conditional', basis: 'createDestination'});
  ['update', 'upgrade', 'delete'].forEach((operation) => {
    assert.strictEqual(cell(value, key(scope), operation).state, 'conditional');
    assert.strictEqual(cell(value, key(scope), operation).basis, 'multipleTargets');
  });
  ['exec', 'logs', 'export'].forEach((operation) => assert.strictEqual(cell(value, key(scope), operation).state, 'deny'));
});

test('child write exceptions remain mixed rather than becoming misleading uniform conditional grants', function(assert) {
  let p = project(), child = resource();
  let value = matrix(custom('deny', [rule('p', 'allow', p, ['create', 'update']), rule('child', 'deny', child, ['create', 'update'])]),
    {p: proof(p, {label: 'Production'}), child: proof(child)});
  ['create', 'update'].forEach((operation) => assert.strictEqual(cell(value, key(p), operation).state, 'mixed'));
});

test('invalid policy drafts yield unknown across every cell instead of partial grants', function(assert) {
  let invalid = [null, {}, {mode: 'full', defaultEffect: 'deny'}, {mode: 'closed', defaultEffect: 'allow'},
    custom('bad'), custom('allow', [rule('bad', 'allow', stack(' '))]),
    custom('allow', [rule('bad', 'allow', global(), ['*'])]),
    custom('allow', [rule('bad', 'allow', global(), [])]),
    custom('allow', [rule('dup', 'allow', global()), rule('dup', 'deny', global())]),
    custom('allow', [rule('dup-op', 'allow', global(), ['read', 'read'])]),
    custom('allow', [rule('bad-type', 'allow', resource('pluginUnknown', 'item-a'))])];
  invalid.forEach((policy) => assert.ok(matrix(policy).rows.every((row) => row.cells.every((item) => item.state === 'unknown' && item.basis === 'invalidPolicy'))));
});

test('injected clock enforces before/equal/after expiry over every operation and scope', function(assert) {
  let scope = resource(), deadline = Date.parse('2030-01-02T03:04:05.000Z');
  ['full', 'closed', 'custom'].forEach((mode) => {
    let policy = {mode, defaultEffect: mode === 'closed' ? 'deny' : 'allow', expiresAt: '2030-01-02T03:04:05.000Z',
      rules: mode === 'custom' ? [rule('item', 'allow', scope, API_KEY_OPERATIONS)] : []};
    let before = buildPolicyMatrix(policy, {item: proof(scope)}, labels, deadline - 1);
    assert.notOk(before.rows.some((row) => row.cells.some((item) => item.basis === 'expired')), mode);
    [deadline, deadline + 1].forEach((now) => {
      let result = buildPolicyMatrix(policy, {}, labels, now);
      assert.ok(result.rows.every((row) => row.cells.every((item) => item.state === 'deny' && item.basis === 'expired')), `${mode}: ${now - deadline}`);
    });
  });
});

test('invalid or ambiguous expiry is unknown, not a timeless grant or fake expired denial', function(assert) {
  ['', 'not-a-date', '2030-01-02', '2030-01-02T03:04:05', 123, {}, '2030-99-99T99:99:99Z'].forEach((expiresAt) => {
    let result = buildPolicyMatrix({mode: 'full', defaultEffect: 'allow', rules: [], expiresAt}, {}, labels, 0);
    assert.ok(result.rows.every((row) => row.cells.every((item) => item.state === 'unknown' && item.basis === 'invalidPolicy')));
  });
  let invalidNow = buildPolicyMatrix({mode: 'full', defaultEffect: 'allow', rules: [], expiresAt: '2030-01-02T03:04:05Z'}, {}, labels, NaN);
  assert.strictEqual(cell(invalidNow, 'default').basis, 'invalidPolicy');
});

test('helper does not mutate inputs or expose raw scope IDs as names', function(assert) {
  let scope = resource(), policy = custom('allow', [rule('item', 'deny', scope)]);
  let evidence = {item: proof(scope, {label: 'Production / App / Web — Blue'})};
  let before = JSON.stringify({policy, evidence, labels});
  let first = matrix(policy, evidence), second = matrix(policy, evidence);
  assert.deepEqual(first, second);
  assert.strictEqual(JSON.stringify({policy, evidence, labels}), before);
  assert.strictEqual(first.rows[1].label, 'Production / App / Web — Blue');
  assert.notOk(first.rows[1].label.includes(scope.resourceId));
  assert.ok(first.rows.every((row) => row.cells.every((item) => POLICY_MATRIX_STATES.includes(item.state) && POLICY_MATRIX_BASIS.includes(item.basis))));
});
