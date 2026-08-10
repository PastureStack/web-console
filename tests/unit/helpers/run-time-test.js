import { runTime } from 'ui/helpers/run-time';
import { module, test } from 'qunit';

module('Unit | Helper | run time');

test('it localizes exact-second durations', function(assert) {
  var previousLocale = moment.locale();
  var start = moment.parseZone('2026-07-20T21:48:00+08:00');
  var end = moment.parseZone('2026-07-20T21:48:42+08:00');

  moment.locale('zh-tw');
  assert.equal(runTime([start, end]), '42秒', 'Taiwan');

  moment.locale('ja');
  assert.equal(runTime([start, end]), '42秒', 'Japan');

  moment.locale('ko');
  assert.equal(runTime([start, end]), '42초', 'South Korea');

  moment.locale('tl-ph');
  assert.equal(runTime([start, end]), '42 segundo', 'Philippines');

  moment.locale(previousLocale);
});
