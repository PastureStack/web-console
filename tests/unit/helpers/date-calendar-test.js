import { module, test } from 'qunit';

import {
  dateCalendar
} from 'ui/helpers/date-calendar';

module('Unit | Helper | date calendar');

// Replace this with your real tests.
test('it works', function(assert) {
  var result = dateCalendar([42]);
  assert.ok(result);
});

test('it uses a complete Taiwan date for Traditional Chinese', function(assert) {
  var previousLocale = moment.locale();
  var d = moment.parseZone('2026-07-20T21:48:35+08:00');

  moment.locale('zh-tw');
  assert.equal(dateCalendar([d]), '2026年7月20日 晚上09點48分35秒');
  moment.locale(previousLocale);
});
