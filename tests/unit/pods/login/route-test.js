import { run } from '@ember/runloop';
import { resolve } from 'rsvp';

import { module, test } from 'qunit';
import LoginRoute from 'ui/login/index/route';
import ParentLoginRoute, { shibbolethTestRequested } from 'ui/login/route';

module('Unit | Route | login/index');

test('it exists', function(assert) {
  var route = LoginRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('the parent login route tolerates transitions without query parameters', function(assert) {
  assert.false(shibbolethTestRequested(), 'a missing transition is not a Shibboleth test');
  assert.false(shibbolethTestRequested({}), 'missing query parameters are handled');
  assert.false(shibbolethTestRequested({queryParams: {}}), 'ordinary login is not a Shibboleth test');
  assert.true(shibbolethTestRequested({queryParams: {shibbolethTest: '1'}}), 'the explicit test flag remains recognized');
});

test('activate and deactivate toggle farm body class', function(assert) {
  var route = LoginRoute.create();
  var body = $('BODY');

  body.removeClass('farm');
  route.activate();
  assert.ok(body.hasClass('farm'));

  route.deactivate();
  assert.notOk(body.hasClass('farm'));
  run(() => route.destroy());
});

test('the parent login route adopts a valid shared session after an event was missed', async function(assert) {
  let validations = 0;
  let destination;
  let route = ParentLoginRoute.create({
    access: {
      enabled: true,
      ensureSession() {
        validations++;
        return resolve({status: 'active'});
      },
    },
    language: {initUnauthed() { return resolve(); }},
    session: {get() { return undefined; }},
    router: {replaceWith(name) { destination = name; }},
  });

  await route.beforeModel({targetName: 'login.index', queryParams: {timedOut: true}});

  assert.strictEqual(validations, 1, 'the shared cookie is revalidated on login entry');
  assert.strictEqual(destination, 'authenticated', 'a valid session resumes without another login ceremony');
  run(() => route.destroy());
});

test('an OIDC callback keeps its captured generation instead of being bypassed by boot recovery', async function(assert) {
  let validations = 0;
  let route = ParentLoginRoute.create({
    access: {
      enabled: true,
      ensureSession() {
        validations++;
        return resolve({status: 'active'});
      },
    },
    language: {initUnauthed() { return resolve(); }},
  });

  await route.beforeModel({targetName: 'login.oidc-auth', queryParams: {code: 'opaque-code'}});

  assert.strictEqual(validations, 0, 'the callback proceeds to the generation-aware callback handler');
  run(() => route.destroy());
});
