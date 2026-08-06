import Ember from 'ember';

export default Ember.Controller.extend({
  model: null,
  editing: false,
  tab: 'access',

  queryParams: ['editing','tab'],

  actions: {
    done() {
      this.get('router').transitionTo('settings.projects');
    },

    cancel() {
      this.get('router').transitionTo('settings.projects');
    },
  },
});
