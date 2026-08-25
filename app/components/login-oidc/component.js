import { later } from '@ember/runloop';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  oidc: service(),

  actions: {
    authenticate: function() {
      this.sendAction('action');
      later(() => {
        this.get('oidc').authorizeRedirect().catch((err) => {
          this.sendAction('errorAction', err);
        });
      }, 10);
    },
  },
});
