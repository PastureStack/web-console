import { sort } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

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
    // Bubble these closure actions to the route.  This preserves the machine
    // driver component contract without the unmaintained route-action addon.
    cancel() {
      return true;
    },

    goBack() {
      return true;
    },

    switchDriver(name) {
      if (this.get('hostId')) {
        this.set('hostId', null);
        this.set('model.clonedModel', null);
      }
      this.set('driver', name);
    },
  },

  allowCustom: function() {
    return this.get(`settings.${C.SETTING.SHOW_CUSTOM_HOST}`) !== false;
  }.property(`settings.${C.SETTING.SHOW_CUSTOM_HOST}`),

  driverObj: function() {
    return this.get('model.availableDrivers').filterBy('name', this.get('driver'))[0];
  }.property('driver'),

  hasOther: function() {
    return this.get('model.availableDrivers').filterBy('hasUi',false).length > 0;
  }.property('model.availableDrivers.@each.hasUi'),

  showPicker: function() {
    return !this.get('projects.current.isWindows') && (
            this.get('model.availableDrivers.length') +
            (this.get('allowOther') && this.get('hasOther') ? 1 : 0) +
            (this.get('allowCustom') ? 1 : 0)
          ) > 1;
  }.property('model.availableDrivers.length','allowOther','hasOther','allowCustom'),

  showManage: function() {
    return !this.get('projects.current.isWindows') && this.get('access.admin');
  }.property('access.admin','projects.current.isWindows'),

  sortedDrivers: sort('model.availableDrivers','sortBy'),
  sortBy: ['name'],
});
