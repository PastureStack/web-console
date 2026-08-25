import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';
import FilterState from 'ui/mixins/filter-state';

const showKinds = ['user','admin'];

export default Controller.extend(FilterState, Sortable, {
  access: service(),

  sortableContent: alias('filteredByKind'),
  sortBy: 'name',
  sorts: {
    state:    ['stateSort','name','id'],
    name:     ['name','id'],
    username: ['username','id'],
    kind:     ['kind','name','id'],
    ip:       ['displayIp','name','id'],
    image:    ['imageUuid','id'],
    command:  ['command','name','id'],
  },

  filteredByKind: function() {
    return this.get('filtered').filter((row) => {
      var kind = (row.get('kind')||'').toLowerCase();
      return showKinds.indexOf(kind) !== -1;
    });
  }.property('filtered.@each.kind'),

  isLocal: function() {
    return this.get('access.provider') === 'localauthconfig';
  }.property('access.provider'),
});
