import { run } from '@ember/runloop';
import { Checkbox, TextArea, TextField } from '@ember/legacy-built-in-components';
import { module, test } from 'qunit';

import { initialize } from 'ui/initializers/extend-ember-input';
import componentWithTestOwner from 'ui/tests/helpers/component-with-test-owner';

module('Initializer | extend ember input');

// Replace this with your real tests.
test('it adds safe style and autocapitalize support to input controls', function(assert) {
  initialize();
  let textField = componentWithTestOwner(TextField).create();
  let textArea = componentWithTestOwner(TextArea).create();
  let checkbox = componentWithTestOwner(Checkbox).create();

  assert.ok(textField.get('attributeBindings').indexOf('autocapitalize') >= 0);
  assert.equal(textField.get('autocapitalize'), 'none');
  assert.ok(textField.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(textArea.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(checkbox.get('attributeBindings').indexOf('_safeStyle:style') >= 0);

  run(() => {
    textField.destroy();
    textArea.destroy();
    checkbox.destroy();
  });
});
