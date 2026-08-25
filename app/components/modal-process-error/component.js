import { alias } from '@ember/object/computed';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  exception: alias('modalService.modalOpts'),
  actions: {
    dismiss: function() {
      this.send('cancel');
    }
  },
});
