import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','serviceId'],
  stackId: null,
  serviceId: null,

  actions: {
    done() {
      return this.get('router').transitionTo('stack', this.get('model.service.stackId'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
