import { alias } from '@ember/object/computed';
import Controller from '@ember/controller';

export default Controller.extend({
  stack: alias('model.stack'),

  showServiceInfo: null,
  selectedService: null,
  noServices: false,
  actions: {
    dismiss: function() {
      this.set('showServiceInfo',false);
    },
    setNoServices: function(val) {
      this.set('noServices', val);
    }
  }
});
