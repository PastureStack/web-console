import { module, test } from 'qunit';

import { legacyAction } from 'ui/utils/legacy-action';

module('Unit | Utility | legacy action');

test('it preserves target, curried value, and event behavior', function(assert) {
  let invocation;
  let prevented = false;
  let stopped = false;
  let context = {
    receiver: {
      save(prefix, value) {
        invocation = [prefix, value];
      },
    },
  };
  let event = {
    target: { value: 'zh-tw' },
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
  };
  let handler = legacyAction(
    [context, 'save', 'language'],
    {
      target: 'receiver',
      value: 'target.value',
      bubbles: false,
    },
    { preventDefaultByDefault: true }
  );

  handler(event);

  assert.deepEqual(invocation, ['language', 'zh-tw']);
  assert.true(prevented);
  assert.true(stopped);
});

test('it ignores disallowed modifier-key clicks', function(assert) {
  let invoked = false;
  let handler = legacyAction([
    {},
    () => {
      invoked = true;
    },
  ]);

  let result = handler({
    ctrlKey: true,
    preventDefault() {},
  });

  assert.true(result);
  assert.false(invoked);
});
