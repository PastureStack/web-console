import { later } from '@ember/runloop';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  github: service(),

  actions: {
    authenticate() {
      this.sendAction('action');
      later(() => {
        this.get('github').authorizeRedirect();
      }, 10);
    }
  }
});

