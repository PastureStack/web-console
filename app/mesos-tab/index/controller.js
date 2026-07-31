import Controller from '@ember/controller';

import { computed } from '@ember/object';

export default Controller.extend({
  activeHostCount: computed('model.hosts', function() {
    return this.get('model.hosts').filterBy('state','active').get('length');
  }),
});
