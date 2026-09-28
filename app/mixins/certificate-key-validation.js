import { service } from '@ember/service';
import Mixin from '@ember/object/mixin';

export default Mixin.create({
  intl: service(),

  validate() {
    this._super(...arguments);
    const key = this.get('model.key') || '';
    const errors = this.get('errors') || [];

    if (/^Proc-Type: 4,ENCRYPTED$/m.test(key) || /^-----BEGIN ENCRYPTED PRIVATE KEY-----$/m.test(key)) {
      errors.push(this.get('intl').t('certificatesPage.encryptedKeyError'));
    }

    this.set('errors', errors);
    return this.get('errors.length') === 0;
  },
});
