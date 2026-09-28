import Controller from '@ember/controller';
import { service } from '@ember/service';
import NewOrEdit from 'ui/mixins/new-or-edit';
import CertificateKeyValidation from 'ui/mixins/certificate-key-validation';

export default Controller.extend(NewOrEdit, CertificateKeyValidation, {
  store: service(),

  actions: {
    cancel() {
      this.get('router').transitionTo('certificates');
    },
  },

  validate() {
    if ( this.get('model.id') ) {
      this.set('errors', null);
      return true;
    }
    return this._super(...arguments);
  },

  doSave() {
    if ( this.get('model.id') ) {
      return this.get('model');
    }
    return this._super(...arguments);
  },

  doneSaving() {
    return this.get('store').find('certificate', this.get('model.id'), {forceReload: true}).then(() => {
      return this.get('router').transitionTo('certificates');
    });
  },

  errorSaving() {
    if ( this.get('model.id') ) {
      this.set('errors', [this.get('intl').t('certificatesPage.new.refreshFailed')]);
    }
  }
});
