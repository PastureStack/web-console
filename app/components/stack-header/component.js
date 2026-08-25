import EmberObject from '@ember/object';
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
