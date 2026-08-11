import Ember from 'ember';
import layout from '../templates/components/sortable-thead';

export default Ember.Component.extend({
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

  current: Ember.computed.alias('sortable.sortBy'),
  descending: Ember.computed.alias('sortable.descending'),

  resolvedColumnRole: Ember.computed('columnRole', 'isActions', function() {
    return this.get('columnRole') || (this.get('isActions') ? 'actions' : null);
  }),

  sortableEnabled: Ember.computed('isSortable', 'isActions', function() {
    return !this.get('isActions') && this.get('isSortable') !== false;
  }),

  activeAscending: Ember.computed('name','current','descending', function() {
    return !this.get('descending') && this.get('current') === this.get('name');
  }),

  activeDescending: Ember.computed('name','current','descending', function() {
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
