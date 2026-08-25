import Component from '@ember/component';

export default Component.extend({
  tagName: 'input',
  type: 'radio',
  disabled: false,
  attributeBindings: ['name', 'type', 'checked:checked', 'disabled:disabled'],

  click : function() {
    this.set('selection', this.get('value'));
  },

  checked : function() {
    return this.get('value') === this.get('selection');
  }.property('value','selection')
});
