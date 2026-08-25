import { service } from '@ember/service';
import Controller from '@ember/controller';
export default Controller.extend({
  projects: service(),

  actions: {
    kubernetesReady() {
      this.get('projects').updateOrchestrationState().then(() => {
        this.get('router').transitionTo('k8s-tab.index');
      });
    },
  }
});
