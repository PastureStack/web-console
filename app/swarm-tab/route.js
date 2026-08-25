import { service } from '@ember/service';
import ApplicationsTabRoute from 'ui/applications-tab/route';

export default ApplicationsTabRoute.extend({
  projects: service(),

  beforeModel() {
    this._super(...arguments);
    return this.get('projects').updateOrchestrationState();
  },
});
