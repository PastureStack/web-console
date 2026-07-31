import Controller from '@ember/controller';

import { computed } from '@ember/object';

export default Controller.extend({
  usefulPools: computed('model.all.@each.driverName', function() {
    return this.get('model.all').filter((pool) => {
      return !!pool.get('driverName');
    });
  }),
});
