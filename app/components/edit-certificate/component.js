import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import CertificateKeyValidation from 'ui/mixins/certificate-key-validation';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, CertificateKeyValidation, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  editing: true,
  model: null,

  init() {
    this._super(...arguments);
    this.set('model', this.get('originalModel').clone());
  },

  doneSaving() {
    this.send('cancel');
  },
});
