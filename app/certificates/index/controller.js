import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';
import FilterState from 'ui/mixins/filter-state';

export default Controller.extend(FilterState, Sortable, {
  sortBy: 'name',
  sorts: {
    state:    ['stateSort','name','id'],
    name:     ['name','id'],
    cn:       ['CN','id'],
    expires:  ['expiresDate','id'],
  },
});
