import Ember from 'ember';

export default Ember.Route.extend({
  actions: {
    activate: function() {
      this.get('router').transitionTo('authenticated');
    },
  }
});
