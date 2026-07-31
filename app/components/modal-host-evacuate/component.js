import { next } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import ModalBase from 'lacsso/components/modal-base';
import { alternateLabel } from 'ui/utils/platform';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],
  resources: alias('modalService.modalOpts.model'),
  alternateLabel: alternateLabel,

  actions: {
    evacuate: function() {
      this.get('resources').forEach((resource) => {
        resource.doAction('evacuate');
      });

      next(() => {
        this.send('cancel');
      });
    }
  }
});
