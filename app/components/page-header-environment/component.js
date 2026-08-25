import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  currentPath : null,
  canEdit     : null,

  tagName     : '',

  projects    : service(),
  project     : alias('projects.current'),

  projectChoices: function() {
    return this.get('projects.active').sortBy('name','id');
  }.property('projects.active.@each.{id,displayName,state}'),

  projectIsMissing: function() {
    return this.get('projectChoices').filterBy('id', this.get('project.id')).get('length') === 0;
  }.property('project.id','projectChoices.@each.id'),

  actions: {
    switchProject(id) {
      this.sendAction('switchProject', id);
    },

    switchNamespace(id) {
      this.sendAction('switchNamespace', id);
    },
  }
});
