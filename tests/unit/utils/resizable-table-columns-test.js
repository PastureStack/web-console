import { module, test } from 'qunit';

import { distributeWidths, resizeWidths } from 'ui/utils/resizable-table-columns';

module('Unit | Utility | resizable table columns');

test('it distributes spare width without over-expanding compact columns', function(assert) {
  let widths = distributeWidths([300, 140, 80, 70, 280], 1478);

  assert.equal(widths.reduce((total, width) => total + width, 0), 1478, 'uses the available table width');
  assert.equal(widths[2], 80, 'keeps a compact port column at its measured width');
  assert.equal(widths[3], 70, 'keeps a compact boolean column at its measured width');
  assert.ok(widths[0] > 300 && widths[1] > 140 && widths[4] > 280, 'shares spare width between data columns');
});

test('it preserves intrinsic widths when horizontal scrolling is required', function(assert) {
  assert.deepEqual(distributeWidths([500, 600, 700], 1200), [500, 600, 700]);
});

test('it resizes against the neighbouring column', function(assert) {
  assert.deepEqual(resizeWidths([300, 300, 200], 0, 360), [360, 240, 200]);
  assert.deepEqual(resizeWidths([300, 60, 200], 0, 360), [360, 48, 200], 'grows the table after the neighbour reaches its minimum');
});
