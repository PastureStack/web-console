import Ember from 'ember';

export default Ember.Controller.extend({
  actions: {
    changeCertificate(cert) {
      this.get('router').transitionTo('certificates.detail', cert.get('id'));
    },
  },
});
