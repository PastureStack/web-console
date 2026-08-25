import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  access: service(),

  waiting: null,

  username: null,
  password: null,

  actions: {
    authenticate: function() {
      var code = this.get('username')+':'+this.get('password');
      this.set('password','');
      this.sendAction('action', code);
    }
  }
});

