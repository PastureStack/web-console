import { alias } from '@ember/object/computed';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'large-modal', 'modal-shell'],
  originalModel: alias('modalService.modalOpts'),
});
