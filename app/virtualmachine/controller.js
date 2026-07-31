import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    changeVirtualMachine(vm) {
      this.transitionToRoute('virtualmachine', vm.get('id'));
    }
  },
});
