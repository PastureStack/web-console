import { alias } from '@ember/object/computed';
import Controller, { inject as controller } from '@ember/controller';
import { service } from '@ember/service';

export default Controller.extend({
  application: controller(),
  projects: service(),
  host: alias('model.host'),

  canCreateContainer: function() {
    return this.get('projects').canCreateResource('container');
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration'),

  actions: {
    changeHost(host) {
      this.get('router').transitionTo('host', host.get('id'));
    },
  }
});
