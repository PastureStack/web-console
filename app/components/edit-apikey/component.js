import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  model: null,
  clone: null,
  justCreated: false,
  createOnlyDelivery: true,

  didReceiveAttrs() {
    this.set('clone', this.get('originalModel').clone());
    this.set('model', this.get('originalModel').clone());
    this.set('justCreated', false);
  },

  didInsertElement() {
    this._super(...arguments);
    this._focusTimer = setTimeout(() => {
      this._focusTimer = null;
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      let inputs = this.$('INPUT[type="text"]');
      let input = inputs && inputs[0];
      if (input) {
        input.focus();
      }
    }, 250);
  },

  willDestroyElement() {
    if (this._focusTimer) {
      clearTimeout(this._focusTimer);
      this._focusTimer = null;
    }
    this._super(...arguments);
  },

  editing: function() {
    return !!this.get('clone.id');
  }.property('clone.id'),

  doneSaving: function(neu) {
    if ( this.get('editing') )
    {
      this.send('cancel');
    }
    else
    {
      this.setProperties({
        justCreated: true,
        clone: this.cloneForCreateDelivery(neu)
      });
    }
  },

});
