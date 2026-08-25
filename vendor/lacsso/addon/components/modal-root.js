import $ from 'jquery';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/modal-root';

export default Component.extend({
  layout,
  tagName: 'div',
  classNames: ['lacsso', 'modal-overlay'],
  classNameBindings: ['modalVisible:modal-open:modal-closed'],
  modalService: service('modal'),
  modalType: alias('modalService.modalType'),
  modalVisible: alias('modalService.modalVisible'),
  click(e) {
    if (this.get('modalService.closeWithOutsideClick') && $(e.target).hasClass('modal-open')) {
      this.get('modalService').toggleModal();
    }
  }
});
