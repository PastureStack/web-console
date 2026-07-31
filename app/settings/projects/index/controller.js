import { service } from '@ember/service';
import Controller, { inject as controller } from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  sortBy: 'name',
  sorts: {
    state:        ['stateSort','name','id'],
    name:         ['name','id'],
    description:  ['description','name','id'],
    orchestration:['displayOrchestration','name','id'],
  },

  access: service(),
  projects: service(),
  settings: service(),
  application: controller(),
});
