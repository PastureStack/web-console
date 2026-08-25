import { service } from '@ember/service';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  settings: service(),

  sortableContent: function() {
    let receivers = this.get('model.receivers');
    return receivers.filter(ele => ele.driver !== 'forwardPost');
  }.property('model.receivers.@each.driver'),
  sortBy: 'name',
  sorts: {
    state:        ['stateSort','name','id'],
    name:         ['name','id'],
    kind:         ['displayKind','id'],
  },

});
