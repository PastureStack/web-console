import { alias } from '@ember/object/computed';
import Controller, { inject as controller } from '@ember/controller';

export default Controller.extend({
  application: controller(),
  host: alias('model.host'),

  actions: {
    changeHost(host) {
      this.get('router').transitionTo('host', host.get('id'));
    },
  }
});
