import Ember from 'ember';

export default Ember.Controller.extend({
  projects: Ember.inject.service(),
  consoleWorkspace: Ember.inject.service('console-workspace'),

  available: function() {
    return this.get('projects.orchestrationState.swarmReady') && this.get('model.instance').hasAction('execute');
  }.property('model.instance.actionLinks.execute','projects.orchestrationState.swarmReady'),

  actions: {
    openTerminal(forceNew) {
      this.get('consoleWorkspace').openTerminal(this.get('model.instance'), {
        command: this.get('model.command'),
        forceNew: forceNew === true,
      });
    },
  },
});
