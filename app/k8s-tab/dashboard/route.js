import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  k8s: service(),

  model() {
    return EmberObject.create({
      dashboardUrl: this.get('k8s.kubernetesDashboard'),
    });
  },
});
