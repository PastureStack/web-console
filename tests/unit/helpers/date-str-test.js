import { module, test } from 'qunit';

import {
  dateStr
} from 'ui/helpers/date-str';

module('Unit | Helper | date str');

// Replace this with your real tests.
test('it works', function(assert) {
  var d = new Date('1982-02-24T18:42:00Z');
  var result = dateStr([d]);
  assert.ok(result);
});

test('it takes format strings', function(assert) {
  var previousLocale = moment.locale();
  var d = new Date('1982-02-24T18:42:00Z');

  moment.locale('en');
  var result = dateStr([d],{format: 'MMMM'});
  assert.equal(result, 'February');
  moment.locale(previousLocale);
});

test('it uses Taiwan date and time order for Traditional Chinese', function(assert) {
  var previousLocale = moment.locale();
  var d = moment.parseZone('2026-07-20T21:48:35+08:00');

  moment.locale('zh-tw');
  assert.equal(dateStr([d]), '2026年7月20日 晚上09點48分35秒');
  assert.equal(dateStr([d], {format: 'hh:mm:ss A'}), '晚上09點48分35秒');
  moment.locale(previousLocale);
});

test('it uses primary-region date and time formats for every selectable locale', function(assert) {
  var previousLocale = moment.locale();
  var d = moment.parseZone('2026-07-20T21:48:35+08:00');

  moment.locale('de');
  assert.equal(dateStr([d]), '20. Juli 2026 21:48:35', 'Germany');

  moment.locale('fa');
  assert.equal(dateStr([d]), '۲۰ ژوئیه ۲۰۲۶ ۲۱:۴۸:۳۵', 'Iran');

  moment.locale('fr');
  assert.equal(dateStr([d]), '20 juillet 2026 21:48:35', 'France');

  moment.locale('hu');
  assert.equal(dateStr([d]), '2026. július 20. 21:48:35', 'Hungary');

  moment.locale('ja');
  assert.equal(dateStr([d]), '2026年7月20日 21:48:35', 'Japan');

  moment.locale('ko');
  assert.equal(dateStr([d]), '2026년 7월 20일 오후 9:48:35', 'South Korea');

  moment.locale('tl-ph');
  assert.equal(dateStr([d]), 'Hulyo 20, 2026 9:48:35 PM', 'Philippines');
  assert.equal(dateStr([d], {format: 'hh:mm:ss A'}), '9:48:35 PM', 'Philippines time');

  moment.locale('pt-br');
  assert.equal(dateStr([d]), '20 de julho de 2026 21:48:35', 'Brazil');

  moment.locale('ru');
  assert.equal(dateStr([d]), '20 июля 2026 г. 21:48:35', 'Russia');

  moment.locale('uk');
  assert.equal(dateStr([d]), '20 липня 2026 р. 21:48:35', 'Ukraine');

  moment.locale('zh-cn');
  assert.equal(dateStr([d]), '2026年7月20日 21:48:35', 'Mainland China');

  moment.locale(previousLocale);
});
