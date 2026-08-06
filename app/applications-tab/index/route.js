import Ember from 'ember';

export default Ember.Route.extend({
  redirect: function() {
    if ( this.controllerFor('authenticated').get('hasKubernetes') )
    {
      this.get('router').transitionTo('k8s-tab');
    }
    else if ( this.controllerFor('authenticated').get('hasSwarm') )
    {
      this.get('router').transitionTo('swarm-tab.projects');
    }
    else
    {
      this.get('router').transitionTo('stacks');
    }
  }
});
