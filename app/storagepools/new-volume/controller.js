import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import NewOrEdit from 'ui/mixins/new-or-edit';

export default Controller.extend(NewOrEdit, {
  intl: service(),

  queryParams: ['driverName'],
  driverName: null,

  primaryResource: alias('model.volume'),

  validate: function() {
    var errors = [];

    if ( this.get('primaryResource.name').match(/[^a-z0-9._@-]/i) ) {
      errors.push(this.get('intl').t('formVolumes.errors.invalidName'));
    }

    this.set('errors', errors);
    return errors.length === 0;
  },

  doneSaving() {
    this.transitionToRoute('storagepools');
  },

  actions: {
    cancel() {
      this.send('goToPrevious');
    },
  }
});
