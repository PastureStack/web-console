import { alias } from '@ember/object/computed';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'span-8', 'offset-2'],

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
