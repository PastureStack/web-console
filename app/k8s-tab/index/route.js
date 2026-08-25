import Route from '@ember/routing/route';

export default Route.extend({
  redirect() {
    this.get('router').transitionTo('k8s-tab.dashboard');
  },
});
