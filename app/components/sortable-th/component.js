import { alias } from '@ember/object/computed';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'TH',
  classNames: ['sortable'],
  name: null,
  sortable: null,
  width: null,
  label: null,
  ariaRole: ['columnheader'],

  current: alias('sortable.sortBy'),
  descending: alias('sortable.descending'),

  activeAscending: function() {
    return !this.get('descending') && this.get('current') === this.get('name');
  }.property('name','current','descending'),

  activeDescending: function() {
    return this.get('descending') && this.get('current') === this.get('name');
  }.property('name','current','descending'),

  attributeBindings: ['width'],

  click: function() {
    this.sendAction('action', this.get('name'));
  }
});
