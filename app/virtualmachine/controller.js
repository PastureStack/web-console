import Ember from 'ember';

export default Ember.Controller.extend({
  actions: {
    changeVirtualMachine(id) {
      this.get('router').transitionTo('virtualmachine', id);
    }
  },
});
