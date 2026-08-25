import { service } from '@ember/service';
import Controller from '@ember/controller';

export default Controller.extend({
  projects: service(),

  actions: {
    openDashboard() {
      window.open(this.get('model.dashboardUrl'),'_blank');
    }
  }
});
