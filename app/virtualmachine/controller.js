import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    changeVirtualMachine(id) {
      this.get('router').transitionTo('virtualmachine', id);
    }
  },
});
