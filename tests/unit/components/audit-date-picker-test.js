import { module, test } from 'qunit';
import {
  buildCalendarWeeks,
  calendarWeekStart,
  localizedDateLabel,
  localizedMonthLabel,
  localizedWeekdays,
} from 'ui/components/audit-date-picker/component';

module('Unit | Component | audit date picker');

test('calendar labels follow the selected application locale', function(assert) {
  assert.strictEqual(calendarWeekStart('de-de'), 1, 'German weeks start on Monday');
  assert.strictEqual(calendarWeekStart('fa-ir'), 6, 'Persian weeks start on Saturday');
  assert.strictEqual(calendarWeekStart('zh-tw'), 0, 'Taiwan weeks start on Sunday');

  assert.deepEqual(localizedWeekdays('de-de').slice(0, 2), ['Mo', 'Di']);
  assert.deepEqual(localizedWeekdays('zh-tw').slice(0, 2), ['週日', '週一']);
  let germanMonth = localizedMonthLabel(2026, 7, 'de-de');
  let simplifiedChineseMonth = localizedMonthLabel(2026, 7, 'zh-hans');

  assert.ok(germanMonth.includes('August'));
  assert.ok(simplifiedChineseMonth.includes('8月'));
  assert.notStrictEqual(germanMonth, simplifiedChineseMonth, 'month headings rerender in the selected locale');
  assert.notStrictEqual(localizedDateLabel('2026-08-29', 'de-de'), localizedDateLabel('2026-08-29', 'zh-tw'));
});

test('calendar grid binds selection without changing the ISO date contract', function(assert) {
  let weeks = buildCalendarWeeks(2026, 7, 'de-de', '2026-08-29', '2026-08-30');
  let days = weeks.flat();

  assert.strictEqual(weeks.length, 6);
  assert.true(weeks.every((week) => week.length === 7));
  assert.strictEqual(days.find((day) => day.isSelected).value, '2026-08-29');
  assert.strictEqual(days.find((day) => day.isToday).value, '2026-08-30');
  assert.strictEqual(days[0].value, '2026-07-27', 'the German grid begins on Monday');
});
