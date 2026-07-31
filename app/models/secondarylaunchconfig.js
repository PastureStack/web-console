import Resource from 'ember-api-store/models/resource';

import { computed } from '@ember/object';

var SecondaryLaunchConfig = Resource.extend({
  displayImage: computed('imageUuid', function() {
    return (this.get('imageUuid')||'').replace(/^docker:/,'');
  }),
});

export default SecondaryLaunchConfig;
