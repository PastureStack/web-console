import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import LoginRoute from 'ui/login/index/route';
import { shibbolethTestRequested } from 'ui/login/route';

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
