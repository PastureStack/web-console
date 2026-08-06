import Ember from 'ember';

export default Ember.Route.extend({
  redirect: function() {
    this.get('router').transitionTo('storagepools.pools');
  }
});
