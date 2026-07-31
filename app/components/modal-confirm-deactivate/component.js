import { computed } from '@ember/object';
import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { alternateLabel } from 'ui/utils/platform';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal', 'modal-logs'],
  originalModel  : alias('modalService.modalOpts.originalModel'),
  action         : alias('modalService.modalOpts.action'),
  alternateLabel : alternateLabel,
  intl           : service(),

  actions: {

    confirm: function() {
      this.get('originalModel').send(this.get('action'));
      this.send('cancel');
    },
  },

  didRender: function() {
    setTimeout(() => {
      try {
        this.$('BUTTON')[0].focus();
      } catch (e) {}
    }, 500);
  },

  isService: computed('originalModel.type','intl._locale', function() {
    let type = this.get('originalModel.type');
    let out  = {};
    let intl = this.get('intl');

    switch (type) {
      case 'project':
        out.message = intl.t('modalConfirmDeactivate.buttons.project.message');
        out.button  = intl.t('modalConfirmDeactivate.buttons.project.button');
        break;
      case 'environment':
        out.message = intl.t('modalConfirmDeactivate.buttons.environment.message');
        out.button  = intl.t('modalConfirmDeactivate.buttons.environment.button');
        break;
      default:
        out.message = intl.t('modalConfirmDeactivate.buttons.default.message');
        out.button  = intl.t('modalConfirmDeactivate.buttons.default.button');
        break;
    }

    return out;
  }),
});
