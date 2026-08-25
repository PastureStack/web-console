import { alias } from '@ember/object/computed';
import Controller, { inject as controller } from '@ember/controller';

export default Controller.extend({
  service: alias('model.service'),
  stack: alias('model.stack'),
  application: controller(),

  actions: {
    changeService(service) {
      var transitionTo = this.get('application.currentRouteName');

      if (service.type === 'dnsService') {
        transitionTo = 'service.links';
      }

      this.get('router').transitionTo(transitionTo, service.get('id'));
    }
  }
});
