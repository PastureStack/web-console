import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  sortBy: 'address',
  sorts: {
    state:        ['stateSort','displayAddress','id'],
    address:      ['displayAddress','id'],
    username:     ['credential.publicValue','displayAddress','id'],
    created:      ['created','id']
  },
});
