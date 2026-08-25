import { service } from '@ember/service';
import Controller from '@ember/controller';

export default Controller.extend({
  projects: service(),
  consoleWorkspace: service('console-workspace'),

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
