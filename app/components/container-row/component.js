import { computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';
import {
  formatPercent,
  formatMib,
  formatKbps
} from 'ui/utils/util';

export default Component.extend({
  projects: service(),
  session:  service(),

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

  statsAvailable: computed('model.{state,healthState}', function() {
    return C.ACTIVEISH_STATES.indexOf(this.get('model.state')) >= 0 && this.get('model.healthState') !== 'started-once';
  }),

  detailRoute: computed('model.isVm', function() {
    if ( this.get('model.isVm') ) {
      return 'virtualmachine';
    } else {
      return 'container';
    }
  }),

  cpuRmsDisplay: computed('model.cpuRms', function() {
    return formatPercent(this.get('model.cpuRms') || 0);
  }),

  memoryRmsDisplay: computed('model.memoryRms', function() {
    return formatMib(this.get('model.memoryRms') || 0);
  }),

  networkRmsDisplay: computed('model.networkRms', function() {
    return formatKbps(this.get('model.networkRms') || 0);
  }),

  storageRmsDisplay: computed('model.storageRms', function() {
    return formatKbps(this.get('model.storageRms') || 0);
  }),
});
