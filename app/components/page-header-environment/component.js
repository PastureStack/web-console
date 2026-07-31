import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  currentPath : null,
  canEdit     : null,

  tagName     : '',

  projects    : service(),
  project     : alias('projects.current'),

  projectChoices: computed('projects.active.@each.{id,displayName,state}', function() {
    return this.get('projects.active').sortBy('name','id');
  }),

  projectIsMissing: computed('project.id', 'projectChoices.@each.id', function() {
    return this.get('projectChoices').filterBy('id', this.get('project.id')).get('length') === 0;
  }),

  actions: {
    switchProject(id) {
      this.sendAction('switchProject', id);
    },

    switchNamespace(id) {
      this.sendAction('switchNamespace', id);
    },
  }
});
