import Controller from '@ember/controller';
import NewContainerRouteActions from 'ui/mixins/new-container-route-actions';

export default Controller.extend(NewContainerRouteActions, {
  queryParams: ['stackId','virtualMachineId','hostId'],
  hostId: null,
  stackId: null,
  virtualMachineId: null,
  editing: false,

  actions: {
    done() {
      this.send('goToPrevious');
    },

    cancel() {
      this.send('goToPrevious');
    },
  }
});
