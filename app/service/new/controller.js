import Controller from '@ember/controller';
import NewContainerRouteActions from 'ui/mixins/new-container-route-actions';

export default Controller.extend(NewContainerRouteActions, {
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
        let stackId = this.get('stackId');

        // The query parameter is the immutable route input.  Do not derive
        // navigation from a resource that the successful create response may
        // replace or partially hydrate.
        return stackId ? this.get('router').transitionTo('stack', stackId) : this.get('router').transitionTo('stacks');
      }
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
