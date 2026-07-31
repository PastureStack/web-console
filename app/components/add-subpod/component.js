import Component from '@ember/component';

export default Component.extend({
  tagName: 'a',
  model: null,
  currentController: null,
  label: 'Add',

  classNames: ['btn', 'btn-primary', 'add-to-pod'],

  click: function() {
    this.sendAction();
  }
});
