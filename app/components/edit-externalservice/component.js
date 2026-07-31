import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, {
  classNames         : ['lacsso', 'modal-container', 'large-modal'],
  originalModel      : alias('modalService.modalOpts'),
  existing: alias('originalModel'),
  editing: true,

  service: null,
  primaryResource: alias('service'),

  actions: {
    done() {
      this.send('cancel');
    },
  },

  init() {
    this._super(...arguments);
    var original = this.get('originalModel');
    this.set('service', original.clone());
  },

  doneSaving: function() {
    this.send('cancel');
  },

  didInsertElement() {
    this.$('INPUT')[0].focus();
  },
});
