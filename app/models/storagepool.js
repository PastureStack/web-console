import Resource from 'ember-api-store/models/resource';
import { denormalizeIdArray } from 'ui/utils/api-store-references';

export default Resource.extend({
  type: 'storagePool',

  hosts: denormalizeIdArray('hostIds'),
  volumes: denormalizeIdArray('volumeIds'),
});
