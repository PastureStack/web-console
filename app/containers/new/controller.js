import Controller from '@ember/controller';
import NewContainerRouteActions from 'ui/mixins/new-container-route-actions';

export default Controller.extend(NewContainerRouteActions, {
  queryParams: ['stackId','containerId','hostId'],
  hostId: null,
  stackId: null,
  containerId: null,
  editing: false,

  actions: {
    done() {
      this.get('router').transitionTo('container', this.get('model.instance.id'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  }
});
