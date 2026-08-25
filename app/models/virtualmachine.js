import { service } from '@ember/service';
import Container from 'ui/models/container';

var VirtualMachine = Container.extend({
  modalService: service('modal'),
  actions: {
    console: function() {
      this.get('consoleWorkspace').openVmConsole(this);
    },

    clone: function() {
      this.get('router').transitionTo('virtualmachines.new', {queryParams: {virtualMachineId: this.get('id')}});
    },

    popoutShellVm: function() {
      this.get('consoleWorkspace').openVmConsole(this, {forceNew: true});
    },

    popoutLogs: function() {
      this.get('consoleWorkspace').openLogs(this, {forceNew: true});
    },
  },
});

VirtualMachine.reopenClass({
  mangleIn: function(data) {
    // VM's baseType is container, but store doesn't handle
    // virtualMachine -> container -> instance
    data.baseType = 'instance';
    return data;
  },
});

export default VirtualMachine;
