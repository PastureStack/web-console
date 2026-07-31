import { module, test } from 'qunit';

import { get as getNavigationTree } from 'ui/utils/navigation-tree';

module('Unit | Utility | navigation tree');

test('it returns an independent deep clone while preserving callbacks', function(assert) {
  let first = getNavigationTree();
  let second = getNavigationTree();
  let firstCattle = first.find((item) => item.id === 'cattle');
  let secondCattle = second.find((item) => item.id === 'cattle');

  assert.notStrictEqual(first, second);
  assert.notStrictEqual(firstCattle, secondCattle);
  assert.strictEqual(firstCattle.condition, secondCattle.condition);

  firstCattle.queryParams.which = 'changed';
  assert.notEqual(secondCattle.queryParams.which, 'changed');
});
