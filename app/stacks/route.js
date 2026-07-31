import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  projects: service(),

  model: function() {
    return hash({
      stacks: this.get('store').findAll('stack'),
    });
  },

  resetController: function (controller/*, isExisting, transition*/) {
    if ( this.get('projects.current.orchestrationState.hasKubernetes') ||
        this.get('projects.current.orchestrationState.hasSwarm') ||
        this.get('projects.current.orchestrationState.hasMesos') ) {
      controller.set('which', C.EXTERNAL_ID.KIND_INFRA);
    } else {
      controller.set('which', C.EXTERNAL_ID.KIND_USER);
    }
  },
});
