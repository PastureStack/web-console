import { service } from '@ember/service';
import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  projects: service(),
  settings: service(),
  k8s: service(),

  hosts: null,

  didReceiveAttrs() {
    this.set('hosts', this.get('store').all('host'));
  },

  expectHosts: computed('projects.current.orchestration', function() {
    return ( this.get('projects.current.orchestration') === 'mesos' ? 3 : 1);
  }),

  hasHosts: computed('hosts.length', function() {
    return this.get('hosts.length') >= this.get('expectHosts');
  }),

  actions: {
    kubernetesReady() {
      this.get('k8s').allNamespaces().then(() => {
        this.get('projects').updateOrchestrationState().then(() => {
          this.transitionToRoute('k8s-tab');
        });
      });
    },

    swarmReady() {
      this.get('projects').updateOrchestrationState().then(() => {
        this.transitionToRoute('swarm-tab');
      });
    },

    mesosReady() {
      this.get('projects').updateOrchestrationState().then(() => {
        this.transitionToRoute('mesos-tab');
      });
    },
  },
});
