import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','serviceId','containerId','upgrade'],
  stackId: null,
  serviceId: null,
  containerId: null,
  upgrade: null,

  actions: {
    done() {
      if ( this.get('upgrade') ) {
        this.send('goToPrevious','stacks');
      } else {
        return this.get('router').transitionTo('stack', this.get('model.service.stackId'));
      }
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
