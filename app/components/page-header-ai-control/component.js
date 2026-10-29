import Component from '@ember/component';
import { service } from '@ember/service';

export default Component.extend({
  tagName: '',
  modalService: service('modal'),
  actions: {
    open() {
      if ( !this.get('app.webmcpAvailable') || this.get('modalService.modalVisible') ) { return; }
      this.get('modalService').toggleModal('modal-ai-collaboration', {escToClose: true});
    },
  },
});
