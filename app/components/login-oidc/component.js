import Ember from 'ember';

export default Ember.Component.extend({
  oidc: Ember.inject.service(),

  actions: {
    authenticate: function() {
      this.sendAction('action');
      Ember.run.later(() => {
        this.get('oidc').authorizeRedirect().catch((err) => {
          this.sendAction('errorAction', err);
        });
      }, 10);
    },
  },
});
