import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    let service = this.modelFor('service').get('service');
    if ( service.get('type').toLowerCase() !== 'loadbalancerservice' ) {
      this.get('router').transitionTo('service.ports');
      return;
    }

    service.initPorts();
    return service;
  }
});
