import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    changeContainer(container) {
      this.get('router').transitionTo('container', container.get('id'));
    }
  },
});
