import { get, set } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';

export default Component.extend({
  instance: null,
  availableDrivers: null,
  errors: null,

  disksArray: alias('instance.disks'),

  init() {
    this._super(...arguments);
    var defaultDriver = this.get('availableDrivers').objectAt(0);

    var disks = (this.get('instance.disks')||[]).slice();
    disks.forEach((disk) => {
      if ( !get(disk, 'driver') )
      {
        set(disk, 'driver', defaultDriver);
      }
    });

    this.set('instance.disks', disks);
  },

  driverChoices: function() {
    return this.get('availableDrivers').map((name) => {
      return {label: name, value: name};
    });
  }.property('availableDrivers.[]'),

  disksChanged: function() {
    var errors = [];

    this.get('instance.disks').forEach((disk) => {
      var name = (get(disk,'name')||'').trim().toLowerCase();
      set(disk, 'name', name);

      if ( name.match(/([^a-z0-9._-])/) )
      {
        errors.push(`Disk name "${name}" contains invalid character(s).  Names can only contain a-z, 0-9, dot, dash, and underscore.`);
      }
      else if ( !name )
      {
        errors.push('A name is required for each disk.');
      }
    });

    if ( errors.length )
    {
      this.set('errors', errors);
    }
    else
    {
      this.set('errors', null);
    }
  }.observes('instance.disks.@each.name'),

  hasRoot: function() {
    return this.get('instance.disks').filterBy('root',true).length > 0;
  }.property('instance.disks.@each.root'),

  actions: {
    addRootDisk() {
      this.get('instance.disks').unshiftObject({
        name: 'root',
        root: true,
        driver: this.get('availableDrivers').objectAt(0)
      });
    },

    addDisk() {
      this.get('instance.disks').pushObject({
        name: '',
        root: false,
        size: '40g',
        driver: this.get('availableDrivers').objectAt(0)
      });
    },

    removeDisk(obj) {
      this.get('instance.disks').removeObject(obj);
    },
  },
});
