import { computed } from '@ember/object';
import Resource from 'ember-api-store/models/resource';
import C from 'ui/utils/constants';
import { formatSi } from 'ui/utils/util';

var Instance = Resource.extend({
  isSystem: computed('system', 'labels', function() {
    if ( this.get('system') ) {
      return true;
    }

    let labels = this.get('labels');
    return labels && !!labels[C.LABEL.SYSTEM_TYPE];
  }),

  memoryReservationBlurb: computed('memoryReservation', function() {
    if ( this.get('memoryReservation') ) {
      return formatSi(this.get('memoryReservation'), 1024, 'iB', 'B');
    }
  }),
});

export default Instance;
