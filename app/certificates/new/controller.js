import Controller from '@ember/controller';
import NewOrEdit from 'ui/mixins/new-or-edit';

import { computed } from '@ember/object';

export default Controller.extend(NewOrEdit,{
  isEncrypted: computed('model.key', function() {
    var key = this.get('model.key')||'';
    return key.match(/^Proc-Type: 4,ENCRYPTED$/m) || key.match(/^-----BEGIN ENCRYPTED PRIVATE KEY-----$/m);
  }),

  actions: {
    cancel() {
      this.transitionToRoute('certificates');
    },
  },

  validate() {
    this._super();
    var errors = this.get('errors', errors)||[];

    if ( this.get('isEncrypted') )
    {
      errors.push('The private key cannot be password-protected.');
    }

    this.set('errors', errors);
    return this.get('errors.length') === 0;
  },

  doneSaving() {
    this.transitionToRoute('certificates');
  }
});
