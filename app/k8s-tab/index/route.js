import Ember from 'ember';

export default Ember.Route.extend({
  redirect() {
    this.get('router').transitionTo('k8s-tab.dashboard');
  },
});
