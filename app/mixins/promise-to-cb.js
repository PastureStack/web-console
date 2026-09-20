import Mixin from '@ember/object/mixin';
import promiseToCallback from 'ui/utils/promise-to-callback';

export default Mixin.create({
  toCb(name_or_fn, ...args) {
    return (results, cb) => {
      if ( typeof results === 'function' ) {
        cb = results;
        results = null;
      }

      return promiseToCallback(() => {
        if ( typeof name_or_fn === 'string' ) {
          return this[name_or_fn](...args, results);
        } else {
          return name_or_fn(...args, results);
        }
      }, cb);
    };
  }
});

