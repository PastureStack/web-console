import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import ModalBase from 'lacsso/components/modal-base';
import auditObjectDisplay from 'ui/utils/audit-object-display';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'large-modal', 'audit-log-detail-modal'],
  requestObject  : alias('modalService.modalOpts.requestObject'),
  responseObject  : alias('modalService.modalOpts.responseObject'),
  requestDisplay: computed('requestObject', function() {
    return auditObjectDisplay(this.get('requestObject'));
  }),
  responseDisplay: computed('responseObject', function() {
    return auditObjectDisplay(this.get('responseObject'));
  }),
  requestJSON: alias('requestDisplay.text'),
  responseJSON: alias('responseDisplay.text'),

  actions: {
    dismiss: function() {
      this.send('cancel');
    }
  },
});
