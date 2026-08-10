/* global define */
(function(global) {
  'use strict';

  define('fetch', ['exports'], function(exports) {
    var requiredApis = [
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController'
    ];

    requiredApis.forEach(function(name) {
      if (typeof global[name] === 'undefined') {
        throw new Error('This browser does not provide the required ' + name + ' API.');
      }

      Object.defineProperty(exports, name, {
        configurable: true,
        enumerable: true,
        get: function() {
          return global[name];
        }
      });
    });

    exports.default = function() {
      return global.fetch.apply(global, arguments);
    };
  });

  define('fetch/ajax', ['exports'], function() {
    throw new Error('The legacy fetch/ajax module was renamed to ember-fetch/ajax.');
  });
}(typeof globalThis !== 'undefined' ? globalThis :
  typeof window !== 'undefined' ? window :
  typeof self !== 'undefined' ? self : this));
