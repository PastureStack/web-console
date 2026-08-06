import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['stackId','serviceId','virtualMachineId','upgrade'],
  stackId: null,
  serviceId: null,
  virtualMachineId: null,
  upgrade: null,

  actions: {
    done() {
      return this.get('router').transitionTo('stack', this.get('model.service.stackId'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
