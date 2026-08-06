import { module, test } from 'qunit';
import {
  createLegacyClosureAction,
  invokeLegacyModifierAction,
  isAllowedActionEvent,
  processActionArguments,
} from 'ui/utils/legacy-template-action';

module('Unit | Utility | Legacy template action', function() {
  test('invokes a quoted action with curried and invocation arguments', function(assert) {
    const target = {
      actions: {
        save(prefix, value) {
          assert.strictEqual(this, target);
          return `${ prefix }:${ value }`;
        },
      },
    };
    const action = createLegacyClosureAction(target, 'save', ['item']);

    assert.strictEqual(action('42'), 'item:42');
  });

  test('preserves function context and named target behavior', function(assert) {
    const context = { name: 'context' };
    const target = { name: 'target' };
    const action = createLegacyClosureAction(context, function() {
      return this.name;
    }, [], { target });

    assert.strictEqual(action(), 'context', 'function actions retain the calling context');
  });

  test('processes the legacy value path after merging arguments', function(assert) {
    const event = { target: { value: 'selected' } };

    assert.deepEqual(processActionArguments([], [event], 'target.value'), ['selected']);
  });

  test('enforces pointer modifier keys and dispatches modifier actions', function(assert) {
    const target = {
      sent: null,
      send(name, value) {
        this.sent = [name, value];
      },
    };

    assert.true(isAllowedActionEvent({ type: 'click', button: 0 }, undefined));
    assert.false(isAllowedActionEvent({ type: 'click', button: 0, ctrlKey: true }, undefined));
    assert.true(isAllowedActionEvent({ type: 'click', button: 0, ctrlKey: true }, 'ctrl'));
    invokeLegacyModifierAction(target, 'select', ['value']);
    assert.deepEqual(target.sent, ['select', 'value']);
  });
});
