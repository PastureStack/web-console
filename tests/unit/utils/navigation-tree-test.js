import { module, test } from 'qunit';
import { cloneNavigationValue } from 'ui/utils/navigation-tree';

module('Unit | Utility | Navigation tree', function() {
  test('deeply isolates mutable navigation data while preserving callbacks', function(assert) {
    const condition = () => true;
    const source = [{
      condition,
      queryParams: { which: 'infra' },
      submenu: [{ id: 'hosts' }],
    }];
    const copy = cloneNavigationValue(source);

    assert.notStrictEqual(copy, source);
    assert.notStrictEqual(copy[0], source[0]);
    assert.notStrictEqual(copy[0].queryParams, source[0].queryParams);
    assert.notStrictEqual(copy[0].submenu, source[0].submenu);
    assert.strictEqual(copy[0].condition, condition);
    assert.strictEqual(typeof copy.pushObject, 'function', 'returns an Ember-aware array');

    copy[0].queryParams.which = 'user';
    copy[0].submenu[0].id = 'containers';
    assert.strictEqual(source[0].queryParams.which, 'infra');
    assert.strictEqual(source[0].submenu[0].id, 'hosts');
  });
});
