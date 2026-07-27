import { module, test } from 'qunit';

import {
  columnRoleFromName,
  distributeWidths,
  hasHorizontalOverflow,
  profileForColumn,
  resizeWidths,
} from 'ui/utils/resizable-table-columns';

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

test('it only enables horizontal scrolling for real overflow', function(assert) {
  assert.notOk(hasHorizontalOverflow(1635, 1635), 'an exactly fitted table does not show a scrollbar');
  assert.notOk(hasHorizontalOverflow(1635.2, 1635.8), 'sub-pixel layout rounding does not show a scrollbar');
  assert.ok(hasHorizontalOverflow(1636, 1635), 'a wider table remains horizontally scrollable');
});

test('it keeps selection and action columns compact with semantic profiles', function(assert) {
  let roles = ['selection', 'state', 'name', 'ip', 'host', 'image', 'command', 'actions'];
  let hints = [40, 125, 0, 110, 0, 0, 0, 110];
  let profiles = roles.map((role, index) => profileForColumn(role, hints[index]));
  let widths = distributeWidths([720, 125, 348, 112, 348, 365, 720, 110], 1944, profiles);

  assert.equal(widths.reduce((total, width) => total + width, 0), 1944, 'uses the available table width');
  assert.equal(widths[0], 48, 'selection column uses the checkbox footprint');
  assert.equal(widths[1], 125, 'state respects its explicit compact width');
  assert.equal(widths[3], 112, 'IP address stays compact');
  assert.equal(widths[4], 240, 'host is capped at a readable width');
  assert.equal(widths[7], 110, 'action menu keeps its explicit compact width');
  assert.ok(widths[2] > 348, 'name receives useful spare width');
  assert.ok(widths[5] > 365, 'image receives useful spare width');
  assert.ok(widths[6] < 720, 'command no longer starts at the global maximum');
});

test('it derives semantic roles from sortable field names', function(assert) {
  assert.equal(columnRoleFromName('stateSort'), 'state');
  assert.equal(columnRoleFromName('primaryHost.displayName'), 'host');
  assert.equal(columnRoleFromName('displayIp'), 'ip');
  assert.equal(columnRoleFromName('imageUuid'), 'image');
  assert.equal(columnRoleFromName('command'), 'command');
  assert.equal(columnRoleFromName('createdTS'), 'date');
  assert.equal(columnRoleFromName('cpuRms'), 'metric');
  assert.equal(columnRoleFromName('memoryRms'), 'metric');
  assert.equal(columnRoleFromName('name'), 'name');
  assert.equal(columnRoleFromName('unclassifiedField'), null);
});

test('it resizes against the neighbouring column', function(assert) {
  assert.deepEqual(resizeWidths([300, 300, 200], 0, 360), [360, 240, 200]);
  assert.deepEqual(resizeWidths([300, 60, 200], 0, 360), [360, 48, 200], 'grows the table after the neighbour reaches its minimum');
});
