import { scheduleOnce } from '@ember/runloop';
import { service } from '@ember/service';
import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  settings: service(),

  clone           : null,
  primaryResource : alias('originalModel'),
  errors          : null,

  init() {
    this._super(...arguments);
    this.set('clone', this.get('originalModel').clone());
    this.set('model', this.get('originalModel').clone());
    scheduleOnce('afterRender', () => {
      this.$('INPUT')[0].focus();
    });
  },

  editing: function() {
    return !!this.get('clone.id');
  }.property('clone.id'),

  doneSaving() {
    this.send('cancel');
  }
});
