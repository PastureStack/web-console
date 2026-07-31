import { sort } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Controller.extend({
  access: service(),
  settings: service(),
  projects: service(),

  queryParams : ['backTo', 'driver', 'hostId'],
  backTo      : null,
  driver      : null,
  hostId      : null,

  allowOther  : true,

  actions: {
    switchDriver(name) {
      if (this.get('hostId')) {
        this.set('hostId', null);
        this.set('model.clonedModel', null);
      }
      this.set('driver', name);
    },
  },

  allowCustom: computed(`settings.${C.SETTING.SHOW_CUSTOM_HOST}`, function() {
    return this.get(`settings.${C.SETTING.SHOW_CUSTOM_HOST}`) !== false;
  }),

  driverObj: computed('driver', function() {
    return this.get('model.availableDrivers').filterBy('name', this.get('driver'))[0];
  }),

  hasOther: computed('model.availableDrivers.@each.hasUi', function() {
    return this.get('model.availableDrivers').filterBy('hasUi',false).length > 0;
  }),

  showPicker: computed(
    'model.availableDrivers.length',
    'allowOther',
    'hasOther',
    'allowCustom',
    function() {
      return !this.get('projects.current.isWindows') && (
              this.get('model.availableDrivers.length') +
              (this.get('allowOther') && this.get('hasOther') ? 1 : 0) +
              (this.get('allowCustom') ? 1 : 0)
            ) > 1;
    }
  ),

  showManage: computed('access.admin', 'projects.current.isWindows', function() {
    return !this.get('projects.current.isWindows') && this.get('access.admin');
  }),

  sortedDrivers: sort('model.availableDrivers','sortBy'),
  sortBy: ['name'],
});
