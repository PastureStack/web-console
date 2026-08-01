(function (global) {
  define('fetch', ['exports'], function(exports) {
    'use strict';
    var Promise = global.Ember.RSVP.Promise;
    var supportProps = [
      'FormData',
      'FileReader',
      'Blob',
      'URLSearchParams',
      'Symbol',
      'ArrayBuffer'
    ];
    var polyfillProps = [
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController'
    ];
    var combinedProps = supportProps;
    if (preferNative) {
      combinedProps = supportProps.concat(polyfillProps);
    }
    function exposeGlobal(prop) {
      if (global[prop]) {
        Object.defineProperty(exports, prop, {
          configurable: true,
          get: function() { return global[prop] },
          set: function(v) { global[prop] = v }
        });
      }
    }
    combinedProps.forEach(exposeGlobal);

    <%= moduleBody %>

    // The polyfill installs these globals after the first exposure pass.  Read
    // them again so the AMD module always exports the actual browser runtime.
    polyfillProps.forEach(exposeGlobal);
    exports['default'] = function() {
      return global.fetch.apply(global, arguments);
    };
    supportProps.forEach(function(prop) {
      delete exports[prop];
    });
  });

  define('fetch/ajax', ['exports'], function() {
    throw new Error('You included `fetch/ajax` but it was renamed to `ember-fetch/ajax`');
  });
}(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this));
