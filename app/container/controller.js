import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    changeContainer(container) {
      this.transitionToRoute('container', container.get('id'));
    }
  },
});
