import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

export default Resource.extend({
  serviceSelectorStr: computed('serviceSelector', function() {
    let all = this.get('serviceSelector')||[];
    return Object.keys(all).map((key) => {
      let val = all[key];
      return key + (val ? '=' + val : '');
    }).join(', ');
  }),
});
