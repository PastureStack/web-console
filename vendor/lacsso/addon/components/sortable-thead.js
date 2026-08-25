import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../templates/components/sortable-thead';

export default Component.extend({
  layout,
  tagName: 'TH',
  classNames: ['lacsso'],
  classNameBindings: ['sortableEnabled:sortable'],
  name: null,
  sortable: null,
  width: null,
  label: null,
  ariaRole: ['columnheader'],
  isActions: false,
  isSortable: true,
  columnRole: null,

  current: alias('sortable.sortBy'),
  descending: alias('sortable.descending'),

  resolvedColumnRole: computed('columnRole', 'isActions', function() {
    return this.get('columnRole') || (this.get('isActions') ? 'actions' : null);
  }),

  sortableEnabled: computed('isSortable', 'isActions', function() {
    return !this.get('isActions') && this.get('isSortable') !== false;
  }),

  activeAscending: computed('name','current','descending', function() {
    return !this.get('descending') && this.get('current') === this.get('name');
  }),

  activeDescending: computed('name','current','descending', function() {
    return this.get('descending') && this.get('current') === this.get('name');
  }),

  attributeBindings: [
    'width',
    'name:data-column-name',
    'resolvedColumnRole:data-column-role',
  ],

  click: function() {
    if ( this.get('sortableEnabled') ) {
      this.sendAction('action', this.get('name'));
    }
  }
});
