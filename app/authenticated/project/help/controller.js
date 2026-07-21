import Ember from 'ember';

export default Ember.Controller.extend({
  settings: Ember.inject.service(),

  modelError: false,
  modelResolved: false,
  hasHosts: true,
  docsLink: Ember.computed.alias('settings.docsBase'),

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
