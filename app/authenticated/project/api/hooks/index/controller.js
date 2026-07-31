import { service } from '@ember/service';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

import { computed } from '@ember/object';

export default Controller.extend(Sortable, {
  settings: service(),

  sortableContent: computed('model.receivers.@each.driver', function() {
    let receivers = this.get('model.receivers');
    return receivers.filter(ele => ele.driver !== 'forwardPost');
  }),
  sortBy: 'name',
  sorts: {
    state:        ['stateSort','name','id'],
    name:         ['name','id'],
    kind:         ['displayKind','id'],
  },

});
