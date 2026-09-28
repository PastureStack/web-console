import { observer } from '@ember/object';
import Component from '@ember/component';
import { service } from '@ember/service';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Component.extend(NewOrEdit, {
  intl: service(),
  model: null,

  userValue: '',
  userValueChanged: observer('userValue', function() {
    this.set('primaryResource.value', AWS.util.base64.encode(this.get('userValue')));
  }),

  validate() {
    if ( !this.get('editing') && this.get('model.id') ) {
      this.set('errors', null);
      return true;
    }

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
      if ( this.get('model.id') ) {
        return this.get('model');
      }
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
    if ( this.get('editing') ) {
      return this.sendAction('cancel');
    }

    const secret = this.get('model');
    return secret.get('store').find('secret', secret.get('id'), {forceReload: true}).then(() => {
      return this.sendAction('cancel');
    });
  },

  errorSaving() {
    if ( !this.get('editing') && this.get('model.id') ) {
      this.set('errors', [this.get('intl').t('newSecret.refreshFailed')]);
    }
  },
});
