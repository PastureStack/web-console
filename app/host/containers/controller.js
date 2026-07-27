import Ember from 'ember';
import C from 'ui/utils/constants';
import ContainerSparkStats from 'ui/mixins/container-spark-stats';

export default Ember.Controller.extend(ContainerSparkStats, {
  prefs: Ember.inject.service(),
  statsSocket: null,
  sortBy: 'name',
  liveSortFields: ['cpuRms', 'memoryRms', 'networkRms', 'storageRms'],
  statsPageSizes: C.TABLES.STATS_PAGE_SIZES,
  statsTablePreferenceKey: C.PREFS.STATS_TABLE_COUNT,

  headers: [
    {
      name: 'stateSort',
      searchField: 'displayState',
      sort: ['stateSort', 'name', 'id'],
      translationKey: 'hostsPage.hostPage.containersTab.table.header.state',
      columnRole: 'state',
      width: '125px',
    },
    {
      name: 'name',
      sort: ['name', 'id'],
      translationKey: 'hostsPage.hostPage.containersTab.table.header.name',
      columnRole: 'name',
    },
    {
      name: 'displayIp',
      sort: ['displayIp', 'name', 'id'],
      translationKey: 'hostsPage.hostPage.containersTab.table.header.ip',
      columnRole: 'ip',
      width: '120px',
    },
    {
      name: 'imageUuid',
      searchField: ['displayImage', 'command'],
      sort: ['imageUuid', 'command', 'name', 'id'],
      translationKey: 'hostsPage.hostPage.containersTab.table.header.image',
      columnRole: 'image',
    },
    {
      name: 'cpuRms',
      sort: ['cpuRms', 'name', 'id'],
      translationKey: 'containersPage.table.cpuRms',
      columnRole: 'metric',
      defaultDescending: true,
      width: '136px',
    },
    {
      name: 'memoryRms',
      sort: ['memoryRms', 'name', 'id'],
      translationKey: 'containersPage.table.memoryRms',
      columnRole: 'metric',
      defaultDescending: true,
      width: '136px',
    },
    {
      name: 'networkRms',
      sort: ['networkRms', 'name', 'id'],
      translationKey: 'containersPage.table.networkRms',
      columnRole: 'metric',
      defaultDescending: true,
      width: '136px',
    },
    {
      name: 'storageRms',
      sort: ['storageRms', 'name', 'id'],
      translationKey: 'containersPage.table.storageRms',
      columnRole: 'metric',
      defaultDescending: true,
      width: '136px',
    },
    {
      isActions: true,
      columnRole: 'actions',
      width: '80px',
    },
  ],
});
