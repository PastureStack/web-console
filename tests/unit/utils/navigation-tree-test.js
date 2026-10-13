import { module, test } from 'qunit';
import {
  cloneNavigationValue,
  get as getNavigationTree,
  normalizeNavigationQueryParams
} from 'ui/utils/navigation-tree';

module('Unit | Utility | Navigation tree', function() {
  test('Account Keys gives zero-environment users one context-free API entry without changing project navigation', function(assert) {
    let tree = getNavigationTree();
    let personal = tree.find((item) => item.id === 'account-api');
    let environment = tree.find((item) => item.id === 'api');
    let context = {get(name) { assert.strictEqual(name, 'hasProject'); return false; }};
    assert.true(personal.condition.call(context));
    assert.false(environment.condition.call(context));
    assert.strictEqual(personal.localizedLabel, 'nav.api.tab');
    assert.strictEqual(personal.route, 'authenticated.account-keys');
    assert.notOk(personal.ctx, 'no project model is required');
    assert.strictEqual(personal.submenu.length, 1, 'no environment-only Hooks item');
    assert.strictEqual(personal.submenu[0].localizedLabel, 'nav.api.keys');
    assert.strictEqual(personal.submenu[0].route, 'authenticated.account-keys');
    assert.notOk(personal.submenu[0].ctx);
    context.get = () => true;
    assert.false(personal.condition.call(context));
    assert.true(environment.condition.call(context));
    assert.strictEqual(environment.route, 'authenticated.project.api.keys');
    assert.strictEqual(environment.ctx.length, 1);
    assert.deepEqual(environment.submenu.map((item) => item.route), [
      'authenticated.project.api.keys', 'authenticated.project.api.hooks',
    ], 'existing environment Keys and Hooks routes are preserved');
  });

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

  test('normalizes LinkTo query parameters to an object', function(assert) {
    const query = { which: 'infra' };

    assert.strictEqual(normalizeNavigationQueryParams(query), query, 'preserves a valid query object');
    assert.deepEqual(normalizeNavigationQueryParams(), {}, 'uses an empty object for a missing query');
    assert.deepEqual(normalizeNavigationQueryParams([]), {}, 'rejects an array query value');
  });
});
