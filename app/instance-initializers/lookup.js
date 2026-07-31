export function initialize(applicationInstance) {
  // Shortcuts for debugging.  These should never be used in code.
  window.l = function(name) {
    return applicationInstance.lookup(name);
  };

  window.lc = function(name) {
    return applicationInstance.lookup('controller:'+name);
  };

  window.s = applicationInstance.lookup('service:store');
  window.us = applicationInstance.lookup('service:user-store');
}

export default {
  name: 'lookup',
  initialize: initialize,
  after: ['user-store'],
};
