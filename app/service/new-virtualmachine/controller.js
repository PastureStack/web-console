import Controller from '@ember/controller';
import NewContainerRouteActions from 'ui/mixins/new-container-route-actions';

export default Controller.extend(NewContainerRouteActions, {
  queryParams: ['stackId','serviceId','virtualMachineId','upgrade'],
  stackId: null,
  serviceId: null,
  virtualMachineId: null,
  upgrade: null,

  actions: {
    done(savedService) {
      let stackId = savedService && (typeof savedService.get === 'function' ? savedService.get('stackId') : savedService.stackId);

      return this.get('router').transitionTo('stack', stackId || this.get('stackId'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
