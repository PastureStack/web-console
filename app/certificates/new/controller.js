import Controller from '@ember/controller';
import { service } from '@ember/service';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Controller.extend(NewOrEdit,{
  intl: service(),
  isEncrypted: function() {
    var key = this.get('model.key')||'';
    return key.match(/^Proc-Type: 4,ENCRYPTED$/m) || key.match(/^-----BEGIN ENCRYPTED PRIVATE KEY-----$/m);
  }.property('model.key'),

  actions: {
    cancel() {
      this.get('router').transitionTo('certificates');
    },
  },

  validate() {
    this._super();
    var errors = this.get('errors')||[];

    if ( this.get('isEncrypted') )
    {
      errors.push(this.get('intl').t('certificatesPage.encryptedKeyError'));
    }

    this.set('errors', errors);
    return this.get('errors.length') === 0;
  },

  doneSaving() {
    this.get('router').transitionTo('certificates');
  }
});
