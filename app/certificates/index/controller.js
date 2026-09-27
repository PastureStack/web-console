import Controller from '@ember/controller';
import { service } from '@ember/service';
import Sortable from 'ui/mixins/sortable';
import FilterState from 'ui/mixins/filter-state';

export default Controller.extend(FilterState, Sortable, {
  projects: service(),

  canCreateCertificate: function() {
    return this.get('projects').canCreateResource('certificate');
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration'),

  sortBy: 'name',
  sorts: {
    state:    ['stateSort','name','id'],
    name:     ['name','id'],
    cn:       ['CN','id'],
    expires:  ['expiresDate','id'],
  },
});
