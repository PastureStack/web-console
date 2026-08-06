import Ember from 'ember';

export default Ember.Route.extend({
  redirect: function(model) {
    if (model.service.kind !== 'dnsService') {
      this.get('router').transitionTo('service.containers');
    } else {
      this.get('router').transitionTo('service.links');
    }
  }
});
