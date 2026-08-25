import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  projects: service(),
  'tab-session': service(),

  beforeModel() {
    this._super(...arguments);
    return this.get('projects').updateOrchestrationState();
  },

  model() {
    var auth = this.modelFor('authenticated');
    return this.get('store').findAll('container').then(() => {
      return auth;
    });
  },
});
