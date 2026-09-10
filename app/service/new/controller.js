import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','serviceId','containerId','upgrade'],
  stackId: null,
  serviceId: null,
  containerId: null,
  upgrade: null,

  actions: {
    done(savedService) {
      if ( this.get('upgrade') ) {
        this.send('goToPrevious','stacks');
      } else {
        let model = this.get('model');
        let modelService = model && (typeof model.get === 'function' ? model.get('service') : model.service);
        let stackId = savedService && (typeof savedService.get === 'function' ? savedService.get('stackId') : savedService.stackId);

        stackId = stackId || (modelService && (typeof modelService.get === 'function' ? modelService.get('stackId') : modelService.stackId)) || this.get('stackId');

        return this.get('router').transitionTo('stack', stackId);
      }
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
