import { alias } from '@ember/object/computed';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';
import { tagChoices, tagsToArray } from 'ui/models/stack';

import { computed } from '@ember/object';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  editing: true,
  model: null,

  actions: {
    addTag(tag) {
      let neu = tagsToArray(this.get('primaryResource.group'));
      neu.addObject(tag);
      this.set('primaryResource.group', neu.join(', '));
    },
  },

  allStacks: null,
  willInsertElement: function() {
    this._super(...arguments);
    var orig = this.get('originalModel');
    var clone = orig.clone();
    delete clone.services;
    this.set('model', clone);
    this.set('allStacks', this.get('store').all('stack'));
  },

  tagChoices: computed('allStacks.@each.group', function() {
    return tagChoices(this.get('allStacks')).sort();
  }),

  doneSaving: function() {
    this.send('cancel');
  }
});
