import { run } from '@ember/runloop';
import Service, { service } from '@ember/service';
import { computed } from '@ember/object';
import C from 'ui/utils/constants';

function pageSizePreference(preference, options, fallback) {
  function normalize(value) {
    let parsed = parseInt(value, 10);

    return options.indexOf(parsed) === -1 ? fallback : parsed;
  }

  return computed(preference, {
    get() {
      return normalize(this.get(preference));
    },

    set(key, value) {
      let normalized = normalize(value);

      this.set(preference, normalized);

      return normalized;
    },
  });
}

export default Service.extend({
  userStore: service('user-store'),

  unremoved: function() {
    return this.get('userStore').all('userpreference');
  }.property('userStore.generation'),

  findByName: function(key) {
    return this.get('unremoved').filterBy('name',key)[0];
  },

  unknownProperty: function(key) {
    var value; // = undefined;

    var existing = this.findByName(key);
    if ( existing )
    {
      try
      {
        value = JSON.parse(existing.get('value'));
      }
      catch (e)
      {
        console.log("Error parsing storage ['"+key+"']");
        //this.notifyPropertyChange(key);
      }
    }

    return value;
  },

  setUnknownProperty: function(key, value) {
    var obj = this.findByName(key);

    // Delete by set to undefined
    if ( value === undefined )
    {
      if ( obj )
      {
        obj.set('value',undefined);
        obj.delete();
        this.notifyPropertyChange(key);
      }

      return;
    }

    if ( !obj )
    {
      obj = this.get('userStore').createRecord({
        type: 'userPreference',
        name: key,
      });
    }

    let neu = JSON.stringify(value);
    if ( !obj.get('id') || obj.get('value') !== neu ) {
      obj.set('value', neu);
      obj.save().then(() => {
        run(() => {
          this.notifyPropertyChange(key);
        });
      });
    }

    return value;
  },

  clear: function() {
    this.beginPropertyChanges();

    this.get('unremoved').forEach((obj) => {
      this.set(obj.get('name'), undefined);
    });

    this.endPropertyChanges();
  },

  tablePerPage: pageSizePreference(
    C.PREFS.TABLE_COUNT,
    C.TABLES.PAGE_SIZES,
    C.TABLES.DEFAULT_COUNT
  ),

  statsTablePerPage: pageSizePreference(
    C.PREFS.STATS_TABLE_COUNT,
    C.TABLES.STATS_PAGE_SIZES,
    C.TABLES.DEFAULT_STATS_COUNT
  ),

  storageTablePerPage: pageSizePreference(
    C.PREFS.STORAGE_TABLE_COUNT,
    C.TABLES.STORAGE_PAGE_SIZES,
    C.TABLES.DEFAULT_STORAGE_COUNT
  ),
});
