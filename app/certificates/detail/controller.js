import Controller from '@ember/controller';

export default Controller.extend({
  actions: {
    changeCertificate(cert) {
      this.get('router').transitionTo('certificates.detail', cert.get('id'));
    },
  },
});
