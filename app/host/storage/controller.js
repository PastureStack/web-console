import Ember from 'ember';
import C from 'ui/utils/constants';
import {
  filterVolumesByState,
  isBulkRemovableVolume,
} from 'ui/utils/volume-bulk-remove';

export default Ember.Controller.extend({
  modalService: Ember.inject.service('modal'),
  prefs: Ember.inject.service(),

  sortBy: 'displayUri',
  storageFilter: 'all',
  selectedVolumes: null,
  storageTableRevision: 0,
  storageTablePerPage: C.TABLES.DEFAULT_STORAGE_COUNT,
  storagePageSizes: C.TABLES.STORAGE_PAGE_SIZES,
  storageTablePreferenceKey: C.PREFS.STORAGE_TABLE_COUNT,
  selectableVolume: isBulkRemovableVolume,

  init() {
    this._super(...arguments);
    let savedPageSize = this.get('prefs.storageTablePerPage');

    this.setProperties({
      selectedVolumes: Ember.A(),
      storageTablePerPage: C.TABLES.STORAGE_PAGE_SIZES.indexOf(savedPageSize) >= 0 ?
        savedPageSize : C.TABLES.DEFAULT_STORAGE_COUNT,
    });
  },

  nonRootVolumes: function() {
    return this.get('model').filter(function(volume) {
      return !volume.get('instanceId') &&
        ['removing', 'removed', 'purging', 'purged'].indexOf(volume.get('state')) === -1;
    });
  }.property('model.[]', 'model.@each.{instanceId,state}', 'storageTableRevision'),

  filteredVolumes: Ember.computed(
    'storageFilter',
    'nonRootVolumes.[]',
    'nonRootVolumes.@each.{state,instanceId,removed,actionLinks,mounts}',
    function() {
      return filterVolumesByState(this.get('nonRootVolumes'), this.get('storageFilter'));
    }
  ),

  hasSelectedVolumes: Ember.computed.gt('selectedVolumes.length', 0),
  selectedVolumeCount: Ember.computed('selectedVolumes.length', function() {
    return String(this.get('selectedVolumes.length') || 0);
  }),

  _removeSuccessfulVolumes(volumes) {
    let successful = Ember.A((volumes || []).slice());
    let model = this.get('model');
    let selected = this.get('selectedVolumes');
    let changed = false;

    successful.forEach((volume) => {
      if ( model && model.includes(volume) ) {
        model.removeObject(volume);
        changed = true;
      }

      if ( selected && selected.includes(volume) ) {
        selected.removeObject(volume);
      }
    });

    if ( changed ) {
      this.incrementProperty('storageTableRevision');
    }
  },

  headers: [
    {
      name: 'state',
      columnKey: 'state',
      searchField: ['displayState', 'state'],
      sort: ['stateSort', 'displayUri', 'id'],
      translationKey: 'hostsPage.hostPage.storageTab.table.header.state',
      columnRole: 'state',
      width: '112px',
    },
    {
      name: 'displayUri',
      columnKey: 'hostPath',
      searchField: ['displayUri', 'name', 'externalId', 'id'],
      sort: ['displayUri', 'id'],
      translationKey: 'hostsPage.hostPage.storageTab.table.header.hostPath',
      columnRole: 'path',
    },
    {
      name: 'mounts.length',
      columnKey: 'mounts',
      searchField: false,
      sort: ['mounts.length', 'displayUri', 'id'],
      translationKey: 'hostsPage.hostPage.storageTab.table.header.mounts',
      columnRole: 'mounts',
    },
    {
      isActions: true,
      columnKey: 'actions',
      columnRole: 'actions',
      width: '75px',
    },
  ],

  actions: {
    changeStorageFilter(value) {
      if ( ['all', 'active', 'detached'].indexOf(value) === -1 )
      {
        return;
      }

      this.setProperties({
        storageFilter: value,
        selectedVolumes: Ember.A(),
      });
    },

    selectionChanged(volumes) {
      this.set('selectedVolumes', Ember.A((volumes || []).slice()));
    },

    storagePageSizeChanged(value) {
      let parsed = parseInt(value, 10);

      if ( C.TABLES.STORAGE_PAGE_SIZES.indexOf(parsed) >= 0 ) {
        this.set('storageTablePerPage', parsed);
      }
    },

    promptRemoveSelected() {
      let selected = this.get('selectedVolumes').filter(isBulkRemovableVolume);

      if ( selected.length === 0 )
      {
        return;
      }

      this.get('modalService').toggleModal('confirm-remove-selected-volumes', {
        volumes: selected.slice(),
        escToClose: true,
        onRemoved: (volume) => {
          Ember.run(() => this._removeSuccessfulVolumes([volume]));
        },
        onComplete: (successful) => {
          Ember.run(() => {
            this._removeSuccessfulVolumes(successful);
          });
        },
      });
    },
  },
});
