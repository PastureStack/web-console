import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import RequireCreatePermission from 'ui/mixins/require-create-permission';

module('Unit | Mixin | require create permission');

test('allows a route only when the effective schema exposes POST', function(assert) {
  assert.expect(3);
  let redirects = 0;
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'stack',
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'stack', 'the route checks its declared resource type');
        return true;
      },
    }),
  });
  route.replaceWith = function() {
    redirects++;
  };

  return route.beforeModel({}).then(() => {
    assert.strictEqual(redirects, 0, 'an authorized route is not redirected');
    assert.strictEqual(route.get('requiredCreateType'), 'stack', 'the capability is explicit');
    run(() => route.destroy());
  });
});

test('redirects direct navigation when POST is absent', function(assert) {
  assert.expect(3);
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'service', 'the service capability is checked');
        return false;
      },
    }),
  });
  route.replaceWith = function(target) {
    assert.strictEqual(target, 'stacks', 'the denied route returns to the safe read-only list');
    return 'redirected';
  };

  return route.beforeModel({}).then((result) => {
    assert.strictEqual(result, 'redirected', 'the redirect transition is returned');
    run(() => route.destroy());
  });
});

test('an upgrade uses PUT capability without opening create-only routes', function(assert) {
  assert.expect(4);
  let redirects = 0;
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    requiredUpdateType: 'service',
    updateWhenQueryParam: 'upgrade',
    store: EmberObject.create({
      canCreate() {
        assert.ok(false, 'an upgrade must not be evaluated as a create');
      },
      getById(type, id) {
        assert.strictEqual(type, 'schema', 'the effective schema is inspected');
        assert.strictEqual(id, 'service', 'the update resource type is explicit');
        return EmberObject.create({resourceMethods: ['GET', 'PUT']});
      },
    }),
  });
  route.replaceWith = function() {
    redirects++;
  };

  return route.beforeModel({to: {queryParams: {upgrade: 'true'}}}).then(() => {
    assert.strictEqual(redirects, 0, 'PUT capability preserves the upgrade workflow');
    assert.strictEqual(route.get('updateWhenQueryParam'), 'upgrade', 'only explicit upgrade flows use PUT');
    run(() => route.destroy());
  });
});

test('upgrade=false remains a create request', function(assert) {
  assert.expect(2);
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    requiredUpdateType: 'service',
    updateWhenQueryParam: 'upgrade',
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'service', 'the declared create capability is checked');
        return false;
      },
      getById() {
        assert.ok(false, 'a false query value must not use update capability');
      },
    }),
  });
  route.replaceWith = function(target) {
    assert.strictEqual(target, 'stacks', 'a denied create request is redirected');
    return 'redirected';
  };

  return route.beforeModel({to: {queryParams: {upgrade: 'false'}}}).then(() => {
    run(() => route.destroy());
  });
});
