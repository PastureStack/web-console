import { module, test } from 'qunit';

import InputPasteComponent from 'ui/components/input-paste/component';

module('Unit | Component | input paste', function() {
  test('accepts the modern array-like clipboard type list', function(assert) {
    assert.expect(4);
    const input = {};
    const component = {
      sendAction(name, text, target) {
        assert.equal(name, 'pasted');
        assert.equal(text, 'net.core.somaxconn');
        assert.strictEqual(target, input);
      },
    };

    const result = InputPasteComponent.prototype.handlePaste.call(component, {
      target: input,
      originalEvent: {
        clipboardData: {
          types: ['text/plain'],
          getData() { return 'net.core.somaxconn'; },
        },
        stopPropagation() {},
        preventDefault() {},
      },
    });

    assert.false(result, 'handled plain text does not continue to the browser default');
  });
});
