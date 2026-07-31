import { alias } from '@ember/object/computed';
import Component from '@ember/component';

import { computed } from '@ember/object';

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

  activeAscending: computed('name', 'current', 'descending', function() {
    return !this.get('descending') && this.get('current') === this.get('name');
  }),

  activeDescending: computed('name', 'current', 'descending', function() {
    return this.get('descending') && this.get('current') === this.get('name');
  }),

  attributeBindings: ['width'],

  click: function() {
    this.sendAction('action', this.get('name'));
  }
});
