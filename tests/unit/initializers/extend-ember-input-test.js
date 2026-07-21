import { module, test } from 'qunit';

import Ember from 'ember';
import { initialize } from 'ui/initializers/extend-ember-input';

module('Initializer | extend ember input');

// Replace this with your real tests.
test('it adds safe style and autocapitalize support to input controls', function(assert) {
  initialize();
  let textField = Ember.TextField.create();
  let textArea = Ember.TextArea.create();
  let checkbox = Ember.Checkbox.create();

  assert.ok(textField.get('attributeBindings').indexOf('autocapitalize') >= 0);
  assert.equal(textField.get('autocapitalize'), 'none');
  assert.ok(textField.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(textArea.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(checkbox.get('attributeBindings').indexOf('_safeStyle:style') >= 0);

  Ember.run(() => {
    textField.destroy();
    textArea.destroy();
    checkbox.destroy();
  });
});
