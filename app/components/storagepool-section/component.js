import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import Component from '@ember/component';
import { service } from '@ember/service';
import Sortable from 'ui/mixins/sortable';

export default Component.extend(Sortable, {
  projects: service(),
  model: null,
  single: false,

  canCreateVolume: computed('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration', function() {
    return this.get('projects').canCreateResource('volume');
  }),

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
