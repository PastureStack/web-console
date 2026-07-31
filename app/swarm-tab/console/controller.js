import { service } from '@ember/service';
import Controller from '@ember/controller';

import { computed } from '@ember/object';

export default Controller.extend({
  projects: service(),
  consoleWorkspace: service('console-workspace'),

  available: computed(
    'model.instance.actionLinks.execute',
    'projects.orchestrationState.swarmReady',
    function() {
      return this.get('projects.orchestrationState.swarmReady') && this.get('model.instance').hasAction('execute');
    }
  ),

  actions: {
    openTerminal(forceNew) {
      this.get('consoleWorkspace').openTerminal(this.get('model.instance'), {
        command: this.get('model.command'),
        forceNew: forceNew === true,
      });
    },
  },
});
