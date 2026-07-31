import { service } from '@ember/service';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  settings: service(),

  sortBy: 'address',
  sorts: {
    state:     ['stateSort','address','uuid'],
    address:   ['address','uuid'],
    port:      ['port','address','uuid'],
    heartbeat: ['heartbeat','address','uuid'],
    clustered: ['clustered','address','uuid'],
  },
});
