import { alias } from '@ember/object/computed';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  project: alias('modalService.modalOpts.project'),
  catalogs: alias('modalService.modalOpts.catalogs'),
});
