import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import LoginRoute from 'ui/login/index/route';

module('Unit | Route | login/index');

test('it exists', function(assert) {
  var route = LoginRoute.create();
  assert.ok(route);
  run(() => route.destroy());
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
