import Ember from 'ember';

export default Ember.Route.extend({
  redirect: function() {
    this.get('router').replaceWith('host.containers');
  },

  model: function() {
    return this.modelFor('host').get('host');
  }
});
