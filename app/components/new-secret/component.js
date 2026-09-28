import { observer } from '@ember/object';
import Component from '@ember/component';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Component.extend(NewOrEdit, {
  model: null,

  userValue: '',
  userValueChanged: observer('userValue', function() {
    this.set('primaryResource.value', AWS.util.base64.encode(this.get('userValue')));
  }),

  validate() {
    const description = this.get('primaryResource.description');
    const clearingDescription = this.get('editing') &&
      typeof description === 'string' && description.trim() === '';
    const valid = this._super(...arguments);
    if ( clearingDescription ) {
      this.set('primaryResource.description', '');
    }
    return valid;
  },

  doSave() {
    if ( !this.get('editing') ) {
      return this._super(...arguments);
    }

    const description = this.get('primaryResource.description');
    return this.get('primaryResource').save({data: {description}}).then(() => {
      const original = this.get('originalModel');
      if ( original ) {
        original.set('description', description);
      }
      return original || this.get('primaryResource');
    });
  },

  actions: {
    cancel() {
      this.sendAction('cancel');
    }
  },

  doneSaving() {
    this.sendAction('cancel');
  },
});
