import Ember from 'ember';
import C from 'ui/utils/constants';
import { formatPercent, formatMib, formatKbps } from 'ui/utils/util';

export default Ember.Component.extend({
  projects: Ember.inject.service(),
  session:  Ember.inject.service(),

  model: null,
  showCommand: 'column', // 'no', 'column', or 'inline'
  showStats: false,
  cpuMax: null,
  memoryMax: null,
  storageMax: null,
  networkMax: null,
  showPrimaryActions: true,
  showStateColumn: true,
  showNameColumn: true,
  showCpuColumn: true,
  showRamColumn: true,
  showNetworkColumn: true,
  showStorageColumn: true,
  showIpColumn: true,
  showHostColumn: true,
  showImageColumn: true,
  showCommandColumn: true,
  showActionsColumn: true,
  tagName: '',

  statsAvailable: function() {
    return C.ACTIVEISH_STATES.indexOf(this.get('model.state')) >= 0 && this.get('model.healthState') !== 'started-once';
  }.property('model.{state,healthState}'),

  detailRoute: function() {
    if ( this.get('model.isVm') ) {
      return 'virtualmachine';
    } else {
      return 'container';
    }
  }.property('model.isVm'),

  cpuRmsDisplay: Ember.computed('model.cpuRms', function() {
    return formatPercent(this.get('model.cpuRms') || 0);
  }),

  memoryRmsDisplay: Ember.computed('model.memoryRms', function() {
    return formatMib(this.get('model.memoryRms') || 0);
  }),

  networkRmsDisplay: Ember.computed('model.networkRms', function() {
    return formatKbps(this.get('model.networkRms') || 0);
  }),

  storageRmsDisplay: Ember.computed('model.storageRms', function() {
    return formatKbps(this.get('model.storageRms') || 0);
  }),
});
