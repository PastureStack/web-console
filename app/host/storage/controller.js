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
  storagePageSizes: C.TABLES.STORAGE_PAGE_SIZES,
  storageTablePreferenceKey: C.PREFS.STORAGE_TABLE_COUNT,
  selectableVolume: isBulkRemovableVolume,

  init() {
    this._super(...arguments);
    this.set('selectedVolumes', Ember.A());
  },

  nonRootVolumes: function() {
    return this.get('model').filter(function(volume) {
      return !volume.get('instanceId') &&
        ['removing', 'removed', 'purging', 'purged'].indexOf(volume.get('state')) === -1;
    });
  }.property('model.@each.{instanceId,state}'),

  filteredVolumes: Ember.computed(
    'storageFilter',
    'nonRootVolumes.[]',
    'nonRootVolumes.@each.{state,instanceId,removed,actionLinks,mounts}',
    function() {
      return filterVolumesByState(this.get('nonRootVolumes'), this.get('storageFilter'));
    }
  ),

  hasSelectedVolumes: Ember.computed.gt('selectedVolumes.length', 0),

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
      if ( ['all', 'active', 'detached', 'removable'].indexOf(value) === -1 )
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

    promptRemoveSelected() {
      let selected = this.get('selectedVolumes').filter(isBulkRemovableVolume);

      if ( selected.length === 0 )
      {
        return;
      }

      this.get('modalService').toggleModal('confirm-remove-selected-volumes', {
        volumes: selected.slice(),
        escToClose: true,
        onComplete: (successful) => {
          Ember.run(() => {
            this.get('model').removeObjects(successful);
            this.get('selectedVolumes').removeObjects(successful);
          });
        },
      });
    },
  },
});
