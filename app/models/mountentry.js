import { equal } from '@ember/object/computed';
import Resource from 'ember-api-store/models/resource';
import { denormalizeId } from 'ember-api-store/utils/denormalize';

export default Resource.extend({
  isReadWrite: equal('permission','rw'),
  isReadOnly:  equal('permission','ro'),

  instance: denormalizeId('instanceId'),
  volume: denormalizeId('volumeId'),
});
