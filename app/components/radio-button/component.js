import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  tagName: 'input',
  type: 'radio',
  disabled: false,
  attributeBindings: ['name', 'type', 'checked:checked', 'disabled:disabled'],

  click : function() {
    this.set('selection', this.get('value'));
  },

  checked : computed('value', 'selection', function() {
    return this.get('value') === this.get('selection');
  })
});
