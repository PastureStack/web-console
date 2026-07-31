import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';

import { observer } from '@ember/object';

export default Controller.extend({
  settings: service(),

  modelError: false,
  modelResolved: false,
  hasHosts: true,
  docsLink: alias('settings.docsBase'),

  modelObserver: observer('model', function() {
    if (this.get('model.resolved')) {

      // @@TODO@@ - need to add some error handling
      this.set('modelResolved', true);
    }

    if (this.get('model.error') ) {

      this.set('modelError', true);
    }

  }),

});
