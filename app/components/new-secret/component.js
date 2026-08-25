import { observer } from '@ember/object';
import Component from '@ember/component';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Component.extend(NewOrEdit, {
  model: null,

  userValue: '',
  userValueChanged: observer('userValue', function() {
    this.set('primaryResource.value', AWS.util.base64.encode(this.get('userValue')));
  }),

  actions: {
    cancel() {
      this.sendAction('cancel');
    }
  },

  doneSaving() {
    this.sendAction('cancel');
  },
});
