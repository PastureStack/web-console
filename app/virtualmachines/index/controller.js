import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  sortBy: 'name',
  sorts: {
    state:    ['stateSort','name','id'],
    name:     ['name','id'],
    ip:       ['displayIp','name','id'],
    image:    ['imageUuid','id'],
  },
});
