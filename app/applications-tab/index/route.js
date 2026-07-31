import Route from '@ember/routing/route';

export default Route.extend({
  redirect: function() {
    if ( this.controllerFor('authenticated').get('hasKubernetes') )
    {
      this.transitionTo('k8s-tab');
    }
    else if ( this.controllerFor('authenticated').get('hasSwarm') )
    {
      this.transitionTo('swarm-tab.projects');
    }
    else
    {
      this.transitionTo('stacks');
    }
  }
});
