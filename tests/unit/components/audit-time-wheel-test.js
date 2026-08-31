import { module, test } from 'qunit';
import {
  repeatTimeWheelOptions,
  timeWheelCycleCount,
  timeWheelLogicalIndex,
  timeWheelMotionHasSettled,
} from 'ui/components/audit-time-wheel/component';

module('Unit | Component | audit time wheel');

test('repeats every option around one selected middle-cycle value', function(assert) {
  let options = [
    { label: '上午', value: 'am' },
    { label: '下午', value: 'pm' },
  ];
  let cycles = timeWheelCycleCount(options.length);
  let repeated = repeatTimeWheelOptions(options, 'pm');

  assert.strictEqual(cycles % 2, 1, 'the repeated list always has a true middle cycle');
  assert.ok(cycles >= 3, 'there are enough repeated cycles to recenter invisibly');
  assert.strictEqual(repeated.length, cycles * options.length);
  assert.strictEqual(repeated.filter((option) => option.selected).length, 1,
    'only the centered copy is exposed as selected to assistive technology');
  assert.strictEqual(repeated.filter((option) => option.accessible).length, options.length,
    'duplicate buffer cycles stay out of the accessibility tree');
  assert.strictEqual(repeated.find((option) => option.selected).value, 'pm');
});

test('maps physical rows back to the same logical value across cycle boundaries', function(assert) {
  assert.strictEqual(timeWheelLogicalIndex(0, 12), 0);
  assert.strictEqual(timeWheelLogicalIndex(12, 12), 0);
  assert.strictEqual(timeWheelLogicalIndex(25, 12), 1);
  assert.strictEqual(timeWheelLogicalIndex(-1, 12), 11,
    'reverse movement wraps to the final logical option');
  assert.strictEqual(timeWheelLogicalIndex(3, 0), -1,
    'an empty wheel cannot manufacture a selection');
});

test('settles when browser scroll quantization leaves a sub-pixel remainder', function(assert) {
  assert.true(timeWheelMotionHasSettled(2520, 2519.0908203125),
    'a device-pixel remainder still commits the selected time');
  assert.false(timeWheelMotionHasSettled(2520, 2518.9),
    'visible travel continues animating instead of committing early');
});
