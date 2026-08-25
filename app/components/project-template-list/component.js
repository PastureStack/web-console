import { service } from '@ember/service';
import Component from '@ember/component';
import Sortable from 'ui/mixins/sortable';

export default Component.extend(Sortable, {
  settings: service(),

  sortBy: 'name',
  sorts: {
    state:        ['stateSort','name','id'],
    name:         ['name','id'],
    description:  ['description','name','id'],
  },
});
