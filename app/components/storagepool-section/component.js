import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import Sortable from 'ui/mixins/sortable';

export default Component.extend(Sortable, {
  model: null,
  single: false,

  sortableContent: alias('model.volumes'),
  sortBy: 'name',
  sorts: {
    state:  ['state','displayName','id'],
    name:   ['displayName','id'],
    mounts: ['mounts.length','displayName','id'],
  },


  init: function() {
    this._super();
  },

  hostsByName: function() {
    return (this.get('model.hosts')||[]).sortBy('displayName');
  }.property('model.hosts.@each.displayName'),

  classNames: ['stack-section','storage', 'clear-section'],
});
