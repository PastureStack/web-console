import Mixin from '@ember/object/mixin';
import { resolve } from 'rsvp';

export default Mixin.create({
  requiredCreateType: null,
  requiredUpdateType: null,
  updateWhenQueryParam: null,

  beforeModel() {
    let parent = this._super(...arguments);
    let transition = arguments[0];

    return resolve(parent).then(() => {
      let query = transition && transition.to && transition.to.queryParams ||
        transition && transition.queryParams || {};
      let updateParam = this.get('updateWhenQueryParam');
      let updateValue = updateParam && query[updateParam];
      let isUpdate = updateValue === true || updateValue === 'true';
      let type = isUpdate ?
        (this.get('requiredUpdateType') || this.get('requiredCreateType')) :
        this.get('requiredCreateType');

      if ( !type ) {
        return;
      }

      let allowed = isUpdate ? this.canUpdateType(type) : this.get('store').canCreate(type);

      if ( allowed ) {
        return;
      }

      return this.replaceWith('stacks');
    });
  },

  canUpdateType(type) {
    let schema = this.get('store').getById('schema', type);
    return Boolean(schema && schema.get('resourceMethods') &&
      schema.get('resourceMethods').includes('PUT'));
  },
});
