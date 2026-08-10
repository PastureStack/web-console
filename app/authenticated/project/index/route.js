import Ember from 'ember';

export default Ember.Route.extend({
  projects: Ember.inject.service(),

  redirect() {
    let orch = this.get('projects.current.orchestration');

    if ( orch === 'kubernetes' )
    {
      this.get('router').replaceWith('k8s-tab');
    }
    else if ( orch === 'swarm' )
    {
      this.get('router').replaceWith('swarm-tab');
    }
    else if ( orch === 'mesos' )
    {
      this.get('router').replaceWith('mesos-tab');
    }
    else
    {
      this.get('router').replaceWith('applications-tab');
    }
  },
});
