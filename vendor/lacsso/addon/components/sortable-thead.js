import Ember from 'ember';
import layout from '../templates/components/sortable-thead';

export default Ember.Component.extend({
  layout,
  tagName: 'TH',
  classNames: ['sortable', 'lacsso'],
  name: null,
  sortable: null,
  width: null,
  label: null,
  ariaRole: ['columnheader'],
  isActions: false,
  columnRole: null,

  current: Ember.computed.alias('sortable.sortBy'),
  descending: Ember.computed.alias('sortable.descending'),

  resolvedColumnRole: Ember.computed('columnRole', 'isActions', function() {
    return this.get('columnRole') || (this.get('isActions') ? 'actions' : null);
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
    this.sendAction('action', this.get('name'));
  }
});
