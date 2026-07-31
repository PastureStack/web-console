import { later } from '@ember/runloop';
import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

export default Resource.extend({
  isDefault: computed('source', 'value', 'activeValue', function() {
    let source = this.get('source');
    if ( !source ) {
      return true;
    }

    if ( source === 'Database' ) {
      return false;
    }

    return this.get('value') === this.get('activeValue');
  }),

  delete() {
    return this._super().then((res) => {
      later(this,'reload',500);
      return res;
    });
  },
});
