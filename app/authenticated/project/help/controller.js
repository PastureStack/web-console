import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Controller from '@ember/controller';

export default Controller.extend({
  settings: service(),
  projects: service(),

  canAddHost: computed('projects.current.id', 'projects.schemaProjectId', function() {
    return this.get('projects').canCreateResource('host');
  }),

  canAddFromCatalog: computed('projects.current.id', 'projects.schemaProjectId', function() {
    return this.get('projects').canCreateResource('stack');
  }),

  modelError: false,
  modelResolved: false,
  hasHosts: true,
  docsLink: alias('settings.docsBase'),

  modelObserver: function() {
    if (this.get('model.resolved')) {

      // @@TODO@@ - need to add some error handling
      this.set('modelResolved', true);
    }

    if (this.get('model.error') ) {

      this.set('modelError', true);
    }

  }.observes('model'),

});
