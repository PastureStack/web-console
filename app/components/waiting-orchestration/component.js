import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  projects: service(),
  settings: service(),
  k8s: service(),

  hosts: null,

  didReceiveAttrs() {
    this.set('hosts', this.get('store').all('host'));
  },

  expectHosts: function() {
    return ( this.get('projects.current.orchestration') === 'mesos' ? 3 : 1);
  }.property('projects.current.orchestration'),

  hasHosts: function() {
    return this.get('hosts.length') >= this.get('expectHosts');
  }.property('hosts.length'),

  actions: {
    kubernetesReady() {
      this.get('k8s').allNamespaces().then(() => {
        this.get('projects').updateOrchestrationState().then(() => {
          this.get('router').transitionTo('k8s-tab');
        });
      });
    },

    swarmReady() {
      this.get('projects').updateOrchestrationState().then(() => {
        this.get('router').transitionTo('swarm-tab');
      });
    },

    mesosReady() {
      this.get('projects').updateOrchestrationState().then(() => {
        this.get('router').transitionTo('mesos-tab');
      });
    },
  },
});
