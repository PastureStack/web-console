import Resource from 'ember-api-store/models/resource';
import { denormalizeId, denormalizeIdArray } from 'ember-api-store/utils/denormalize';

import { computed } from '@ember/object';

export default Resource.extend({
  type: 'lbConfig',

  defaultCertificate: denormalizeId('defaultCertificateId','certificate'),
  certificates: denormalizeIdArray('certificateIds'),

  needsCertificate: computed('portRules.@each.needsCertificate', function() {
    return !!this.get('portRules').findBy('needsCertificate',true);
  }),

  canSticky: computed('portRules.@each.canSticky', function() {
    return !!this.get('portRules').findBy('canSticky',true);
  }),
});
