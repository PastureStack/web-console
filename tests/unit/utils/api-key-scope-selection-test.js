import { A } from '@ember/array';
import EmberObject from '@ember/object';
import Collection from 'ember-api-store/models/collection';
import { module, test } from 'qunit';
import { namedOptions, projectResources, stackParent, resourcesInStack, collectionLink, isPlatformScope,
  hasStackParent, selectionMatches, sameReadableNameFields } from 'ui/utils/api-key-scope-selection';

module('Unit | Utility | API key scope selection');

test('fresh readable description is part of the same-name identity label', function(assert) {
  let candidate = {name: 'Web', description: 'Blue'};
  assert.ok(sameReadableNameFields({name: ' Web ', description: ' Blue '}, candidate));
  assert.notOk(sameReadableNameFields({name: 'Web', description: 'Green'}, candidate));
  assert.notOk(sameReadableNameFields({name: 'Renamed', description: 'Blue'}, candidate));
  assert.ok(sameReadableNameFields({name: 'Web', description: null}, {name: 'Web'}));
});

test('names and readable context never use displayName or stable ID fallback', function(assert) {
  let rows = Collection.create({content: A([
    EmberObject.create({id: 'opaque-a', name: 'Web', description: 'Blue'}),
    EmberObject.create({id: 'opaque-b', displayName: 'opaque-b'}),
    EmberObject.create({id: 'opaque-c', name: 'opaque-c'}),
    EmberObject.create({id: 'opaque-d', name: 'Deleted', removed: true}),
  ])});
  let result = namedOptions(rows, {prefix: 'Team / Production', typeLabel: 'Service'});
  assert.strictEqual(result.options[0].label, 'Team / Production / Web · Service — Blue');
  assert.notOk(result.options[0].label.includes('opaque-a'));
  assert.strictEqual(result.missingNames, 2);
  assert.strictEqual(result.options.length, 1);
  rows.destroy();
});

test('fully indistinguishable names are excluded, descriptions disambiguate without choosing first', function(assert) {
  let result = namedOptions([{id: 'a', name: 'Web'}, {id: 'b', name: 'web'},
    {id: 'c', name: 'Web', description: 'Blue'}, {id: 'd', name: 'Web', description: 'Green'}]);
  assert.strictEqual(result.ambiguous, 2);
  assert.deepEqual(result.options.map((item) => item.label), ['Web — Blue', 'Web — Green']);
});

test('only exact project and verified unique stack relations enter child lists', function(assert) {
  let services = [{id: 's1', stackId: 'st1'}, {id: 's2', stackId: 'st2'}];
  let items = [{id: 'i1', accountId: 'p1', serviceIds: ['s1']},
    {id: 'i2', accountId: 'p1', serviceIds: ['s1', 's2']},
    {id: 'i3', accountId: 'p2', stackId: 'st1'}, {id: 'i4', accountId: 'p1', serviceIds: ['missing']}];
  assert.deepEqual(projectResources(items, 'p1').map((item) => item.id), ['i1', 'i2', 'i4']);
  assert.strictEqual(stackParent(items[1], services), null, 'multiple stack relation never guesses firstObject');
  assert.strictEqual(stackParent(items[3], services), null, 'missing relation is an explicit environment context');
  assert.deepEqual(resourcesInStack(projectResources(items, 'p1'), 'st1', services).map((item) => item.id), ['i1']);
});

test('advertised GET links, aliases and platform scopes preserve real API metadata', function(assert) {
  assert.strictEqual(collectionLink([{id: 'instance', collectionMethods: ['GET'], links: {collection: '/instances'}}], 'container'), '/instances');
  assert.strictEqual(collectionLink([{id: 'host', collectionMethods: ['POST'], links: {collection: '/hosts'}}], 'host'), null);
  assert.strictEqual(collectionLink([{id: 'stack', collectionMethods: ['GET']}], 'stack'), null, 'never invent an unadvertised collection');
  assert.ok(isPlatformScope('project'));
  assert.ok(isPlatformScope('apiKeyRestricted'));
  assert.notOk(hasStackParent('volume'), 'non-stack resource does not get a fake stack');
  assert.ok(hasStackParent('container'));
});

test('review requires matching fresh named-selection evidence, stable IDs stay internal', function(assert) {
  let scope = {kind: 'resource', resourceType: 'container', resourceId: 'i1'};
  let evidence = {scopeKey: 'resource:container:i1', selectionValid: true, contextVerified: true, complete: true,
    selectionLabel: 'Production / Web / Worker'};
  assert.ok(selectionMatches(scope, evidence));
  assert.notOk(selectionMatches(scope, {...evidence, selectionValid: false}));
  assert.notOk(selectionMatches(scope, {...evidence, scopeKey: 'resource:container:i2'}));
  assert.notOk(selectionMatches(scope, {...evidence, selectionLabel: ''}));
  assert.notOk(selectionMatches(scope, {...evidence, complete: false}));
  assert.ok(selectionMatches({kind: 'global'}, null));
});
