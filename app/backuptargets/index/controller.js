import { alias } from '@ember/object/computed';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  sortableContent   : alias('model.all'),
  sortBy: 'name',
  sorts: {
    state        : ['stateSort','name','id'],
    name         : ['name','id'],
    server       : ['nfsConfig.server','name','id'],
    label        : ['nfsConfig.label','name','id'],
    mountOptions : ['nfsConfig.mountOptions','name','id'],
  },

});
