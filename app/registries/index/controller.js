import Controller from '@ember/controller';
import { service } from '@ember/service';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  projects: service(),

  canCreateRegistry: function() {
    let projects = this.get('projects');
    return projects.canCreateResource('registry') && projects.canCreateResource('registryCredential');
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration'),

  sortBy: 'address',
  sorts: {
    state:        ['stateSort','displayAddress','id'],
    address:      ['displayAddress','id'],
    username:     ['credential.publicValue','displayAddress','id'],
    created:      ['created','id']
  },
});
