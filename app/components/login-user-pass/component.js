import Component from '@ember/component';

export default Component.extend({
  waiting: null,

  username: null,
  password: null,
  showPassword: false,

  actions: {
    togglePasswordVisibility() {
      this.toggleProperty('showPassword');
    },

    authenticate: function() {
      var code = this.get('username')+':'+this.get('password');
      this.setProperties({
        password: '',
        showPassword: false,
      });
      this.sendAction('action', code);
    }
  }
});

