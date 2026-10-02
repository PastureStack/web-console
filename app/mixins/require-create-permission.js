import Mixin from '@ember/object/mixin';
import { service } from '@ember/service';
import { resolve } from 'rsvp';

export default Mixin.create({
  growl: service(),
  intl: service(),
  projects: service(),
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

      let projectId = this.get('projects.current.id');
      let schemaCurrent = Boolean(projectId && this.get('projects.schemaProjectId') === projectId);
      let allowed = schemaCurrent && (isUpdate ? this.canUpdateType(type) : this.get('projects').canCreateResource(type));

      if ( allowed ) {
        return;
      }

      this.get('growl').error(
        this.get('intl').t('routePermission.title'),
        this.get('intl').t(isUpdate ? 'routePermission.updateDenied' : 'routePermission.denied')
      );
      return this.get('router').replaceWith('stacks');
    });
  },

  canUpdateType(type) {
    let schema = this.get('store').getById('schema', type);
    return Boolean(schema && schema.get('resourceMethods') &&
      schema.get('resourceMethods').includes('PUT'));
  },
});
