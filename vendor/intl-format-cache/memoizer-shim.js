(function() {
  if (typeof define !== 'function') {
    return;
  }

  function orderedProps(obj) {
    return Object.keys(obj).sort().map(function(key) {
      var out = {};
      out[key] = obj[key];
      return out;
    });
  }

  function cacheId(args) {
    return JSON.stringify(args.map(function(input) {
      return input && typeof input === 'object' ? orderedProps(input) : input;
    }));
  }

  define('intl-format-cache/memoizer', ['exports'], function(exports) {
    'use strict';

    exports.default = function memoizeFormatConstructor(FormatConstructor, cache) {
      cache = cache || {};

      return function() {
        var args = Array.prototype.slice.call(arguments);
        var id = cacheId(args);
        var format = id && cache[id];

        if (!format) {
          var boundArgs = [null].concat(args);
          format = new (Function.prototype.bind.apply(FormatConstructor, boundArgs))();
          if (id) {
            cache[id] = format;
          }
        }

        return format;
      };
    };
  });
})();
