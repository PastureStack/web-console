import Route from '@ember/routing/route';

export default Route.extend({
  redirect: function(model) {
    if (model.service.kind !== 'dnsService') {
      this.transitionTo('service.containers');
    } else {
      this.transitionTo('service.links');
    }
  }
});
