import Ember from 'ember';

export default Ember.Controller.extend({
  actions: {
    changeContainer(container) {
      this.get('router').transitionTo('container', container.get('id'));
    }
  },
});
