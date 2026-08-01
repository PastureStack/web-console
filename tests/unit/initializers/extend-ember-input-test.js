import { module, test } from 'qunit';

import Ember from 'ember';
import { initialize } from 'ui/initializers/extend-ember-input';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Initializer | extend ember input');

// Replace this with your real tests.
test('it adds safe style and autocapitalize support to input controls', function(assert) {
  initialize();
  let textField = createOwned(Ember.TextField, {renderer: inertRenderer()}, 'component');
  let textArea = createOwned(Ember.TextArea, {renderer: inertRenderer()}, 'component');
  let checkbox = createOwned(Ember.Checkbox, {renderer: inertRenderer()}, 'component');

  assert.ok(textField.get('attributeBindings').indexOf('autocapitalize') >= 0);
  assert.equal(textField.get('autocapitalize'), 'none');
  assert.ok(textField.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(textArea.get('attributeBindings').indexOf('_safeStyle:style') >= 0);
  assert.ok(checkbox.get('attributeBindings').indexOf('_safeStyle:style') >= 0);

  destroyOwned(textField);
  destroyOwned(textArea);
  destroyOwned(checkbox);
});
