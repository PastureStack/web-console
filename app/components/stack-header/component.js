import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),
  projects: service(),
  hasVm: alias('projects.current.virtualMachine'),

  createOptions: computed('projects.current.id', 'projects.current.isWindows', 'projects.current.virtualMachine', 'projects.schemaProjectId', 'projects.schemaLoadGeneration', function() {
    let projects = this.get('projects');
    let windows = this.get('projects.current.isWindows');
    let service = projects.canCreateResource('service');
    let balancer = !windows && projects.canCreateResource('loadBalancerService');
    let alias = projects.canCreateResource('dnsService');
    let external = projects.canCreateResource('externalService');
    let vm = service && !windows && this.get('hasVm');

    return {
      service,
      balancer,
      alias,
      external,
      vm,
      other: balancer || alias || external || vm,
      any: service || balancer || alias || external || vm,
    };
  }),

  actions: {
    changeStack(stack) {
      var app = this.get('application');
      this.get('router').transitionTo(app.get('currentRouteName'), stack.get('id'));
      this.sendAction('hideAddtlInfo');
    }
  },

  outputs: function() {
    var out = [];
    var map = this.get('model.outputs')||{};
    Object.keys(map).forEach((key) => {
      out.push(EmberObject.create({
        key: key,
        value: map[key],
      }));
    });

    return out;
  }.property('model.outputs','model.id'),

  listLinkOptions: {
    route: 'stack.index',
  },

  graphLinkOptions: {
    route: 'stack.graph',
  },

  yamlLinkOptions: {
    route: 'stack.code',
  }
});
