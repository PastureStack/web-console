import Ember from 'ember';
export default Ember.Route.extend({
  actions: {
    didTransition: function() {
      // No community forum is operated by PastureStack. Avoid contacting the
      // historical upstream forum or an empty URL from the help page.
      this.controller.set('model', {resolved: true});
      return true; // bubble the transition event
    },
  },

  beforeModel: function() {
    this.get('store').findAll('host').then((hosts) => {
      this.controllerFor('authenticated.project.help').set('hasHosts', hosts.get('length') > 0);
    });
  },

  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('modelResolved', false);
      controller.set('modelError', false);
    }
  }
});
