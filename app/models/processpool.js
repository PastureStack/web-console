import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

export default Resource.extend({
  displayName: computed('name', function() {
    return (this.get('name')||'').replace('Executor','').replace('Service','');
  }),
});
