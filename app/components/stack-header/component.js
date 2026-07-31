import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),
  projects: service(),
  hasVm: alias('projects.current.virtualMachine'),

  actions: {
    changeStack(stack) {
      var app = this.get('application');
      app.transitionToRoute(app.get('currentRouteName'), stack.get('id'));
      this.sendAction('hideAddtlInfo');
    }
  },

  outputs: computed('model.outputs', 'model.id', function() {
    var out = [];
    var map = this.get('model.outputs')||{};
    Object.keys(map).forEach((key) => {
      out.push(EmberObject.create({
        key: key,
        value: map[key],
      }));
    });

    return out;
  }),

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
