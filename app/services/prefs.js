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

  // The original preference setter remains synchronous for legacy UI callers.
  // This explicit path settles only the current user's default-environment write.
  async readDefaultProject(accountId) {
    const rows = await this.get('userStore').find('userpreference', null, {
      url: 'userpreferences', filter: {name: C.PREFS.PROJECT_DEFAULT}, forceReload: true,
    });
    if (!rows || typeof rows.filter !== 'function') { throw new Error('Default preference unavailable'); }
    const matches = rows.filter((row) => row.get('name') === C.PREFS.PROJECT_DEFAULT && !row.get('removed'));
    if (matches.length > 1) { throw new Error('Default preference unavailable'); }
    const record = matches[0];
    if (!record) { return {id: null, projectId: null, record: null}; }
    if (record.get('accountId') !== accountId) { throw new Error('Default preference owner changed'); }
    const projectId = JSON.parse(record.get('value'));
    if (projectId !== null && typeof projectId !== 'string') { throw new Error('Default preference unavailable'); }
    return {id: record.get('id'), projectId, record};
  },

  async saveDefaultProject(projectId, accountId, expected, assertCurrent, commit) {
    const before = await this.readDefaultProject(accountId); assertCurrent();
    if (before.id !== expected.id || before.projectId !== expected.projectId) { throw new Error('Default preference changed'); }
    const record = before.record || this.get('userStore').createRecord({type: 'userPreference', name: C.PREFS.PROJECT_DEFAULT});
    if (before.projectId !== projectId) {
      let saving;
      await commit(() => { record.set('value', JSON.stringify(projectId)); saving = record.save(); });
      await saving;
    }
    assertCurrent();
    const after = await this.readDefaultProject(accountId); assertCurrent();
    if (!after.record || after.projectId !== projectId) { throw new Error('Default preference readback failed'); }
    this.notifyPropertyChange(C.PREFS.PROJECT_DEFAULT);
    return after;
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
