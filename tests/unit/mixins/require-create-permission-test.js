import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import RequireCreatePermission from 'ui/mixins/require-create-permission';
import ProjectsService from 'ui/services/projects';

function beforeModel(route, transition) {
  let current = EmberObject.create({id: 'current-project'});
  let projects = ProjectsService.create({
    current,
    schemaProjectId: 'current-project',
    store: route.get('store'),
  });
  route.set('projects', projects);
  return route.beforeModel(transition).finally(() => {
    run(() => {
      projects.destroy();
      current.destroy();
    });
  });
}

module('Unit | Mixin | require create permission');

test('allows a route only when the effective schema exposes POST', function(assert) {
  assert.expect(4);
  let redirects = 0;
  let notifications = [];
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'stack',
    intl: {t: (key) => key},
    growl: {error(title, body) { notifications.push([title, body]); }},
    router: EmberObject.create({
      replaceWith() {
        redirects++;
      },
    }),
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'stack', 'the route checks its declared resource type');
        return true;
      },
    }),
  });
  return beforeModel(route, {}).then(() => {
    assert.strictEqual(redirects, 0, 'an authorized route is not redirected');
    assert.deepEqual(notifications, [], 'an authorized route has no permission notice');
    assert.strictEqual(route.get('requiredCreateType'), 'stack', 'the capability is explicit');
    run(() => route.destroy());
  });
});

test('redirects direct navigation when POST is absent', function(assert) {
  assert.expect(4);
  let notifications = [];
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    intl: {t: (key) => key},
    growl: {error(title, body) { notifications.push([title, body]); }},
    router: EmberObject.create({
      replaceWith(target) {
        assert.strictEqual(target, 'stacks', 'the denied route returns to the safe read-only list');
        return 'redirected';
      },
    }),
    store: EmberObject.create({
      canCreate(type) {
        assert.strictEqual(type, 'service', 'the service capability is checked');
        return false;
      },
    }),
  });
  return beforeModel(route, {}).then((result) => {
    assert.strictEqual(result, 'redirected', 'the redirect transition is returned');
    assert.deepEqual(notifications, [['routePermission.title', 'routePermission.denied']],
      'a denied create shows exactly one permission notice');
    run(() => route.destroy());
  });
});

test('an upgrade uses PUT capability without opening create-only routes', function(assert) {
  assert.expect(5);
  let redirects = 0;
  let notifications = [];
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    requiredUpdateType: 'service',
    updateWhenQueryParam: 'upgrade',
    intl: {t: (key) => key},
    growl: {error(title, body) { notifications.push([title, body]); }},
    router: EmberObject.create({
      replaceWith() {
        redirects++;
      },
    }),
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
  return beforeModel(route, {to: {queryParams: {upgrade: 'true'}}}).then(() => {
    assert.strictEqual(redirects, 0, 'PUT capability preserves the upgrade workflow');
    assert.deepEqual(notifications, [], 'an authorized upgrade has no create permission notice');
    assert.strictEqual(route.get('updateWhenQueryParam'), 'upgrade', 'only explicit upgrade flows use PUT');
    run(() => route.destroy());
  });
});

test('denied upgrades use the update notice rather than the create notice', function(assert) {
  assert.expect(4);
  let notifications = [];
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    requiredUpdateType: 'service',
    updateWhenQueryParam: 'upgrade',
    intl: {t: (key) => key},
    growl: {error(title, body) { notifications.push([title, body]); }},
    router: EmberObject.create({
      replaceWith(target) {
        assert.strictEqual(target, 'stacks', 'the denied upgrade returns to the safe list');
        return 'redirected';
      },
    }),
    store: EmberObject.create({
      canCreate() {
        assert.ok(false, 'an upgrade must not be evaluated as a create');
      },
      getById(type, id) {
        assert.deepEqual([type, id], ['schema', 'service'], 'the update resource type is checked');
        return EmberObject.create({resourceMethods: ['GET']});
      },
    }),
  });
  return beforeModel(route, {to: {queryParams: {upgrade: 'true'}}}).then((result) => {
    assert.strictEqual(result, 'redirected', 'the redirect transition is returned');
    assert.deepEqual(notifications, [['routePermission.title', 'routePermission.updateDenied']],
      'the denied upgrade shows exactly one update permission notice');
    run(() => route.destroy());
  });
});

test('upgrade=false remains a create request', function(assert) {
  assert.expect(3);
  let notifications = [];
  let route = Route.extend(RequireCreatePermission).create({
    requiredCreateType: 'service',
    requiredUpdateType: 'service',
    updateWhenQueryParam: 'upgrade',
    intl: {t: (key) => key},
    growl: {error(title, body) { notifications.push([title, body]); }},
    router: EmberObject.create({
      replaceWith(target) {
        assert.strictEqual(target, 'stacks', 'a denied create request is redirected');
        return 'redirected';
      },
    }),
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
  return beforeModel(route, {to: {queryParams: {upgrade: 'false'}}}).then(() => {
    assert.deepEqual(notifications, [['routePermission.title', 'routePermission.denied']],
      'upgrade=false uses the create permission notice exactly once');
    run(() => route.destroy());
  });
});
