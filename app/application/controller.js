import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';

export default Controller.extend({
  settings: service(),

  // GitHub auth params
  queryParams     : ['error_description','state','code','isTest', 'isPopup','redirectTo', {oidcError: 'error'}],

  resourceActions : service('resource-actions'),
  tooltipService  : service('tooltip'),

  tooltip         : alias('tooltipService.tooltipOpts.type'),
  tooltipTemplate : alias('tooltipService.tooltipOpts.template'),

  error             : null,
  error_description : null,
  oidcError          : null,
  state             : null,
  code              : null,
  isTest            : null,
  isPopup           : null,
  redirectTo        : null,

  actions: {
    clickedAction: function(actionName) {
      this.get('resourceActions').triggerAction(actionName);
    },
  },

  // currentRouteName is set by Ember.Router
  // but getting the application controller to get it is inconvenient sometimes
  currentRouteNameChanged: function() {
    this.set('app.currentRouteName', this.get('currentRouteName'));
  }.observes('currentRouteName'),

});
