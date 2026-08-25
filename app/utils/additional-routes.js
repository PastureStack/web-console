var list = {};
const instrumentedRouteDsl = new WeakSet();

/* Usage: In your Addon:
 *
 * import { addRoutes } from 'ui/utils/additional-routes';
 *
 * addRoutes(function() {
 *   this.route('hello');
 *   this.route('foo', function() {
 *     this.route('bar', function() {
 *       this.route('baz');
 *     });
 *   });
 * });
 *
 * addRoutes(function() {
 *   this.route('nested-inside');
 * }, 'authenticated.project');
 *
 * @param callback:  Standard Ember Routing DSL function, see Ember.Router.map
 * @param parentRouteName: link-to-style name of the existing route to add these routes to.
 */
export function addRoutes(callback, parentRouteName='application' ) {
  //console.log('addRoutes', callback, parentRouteName);
  if ( !callback )
  {
    return;
  }

  if ( !list )
  {
    throw new Error('Cannot addRoutes after Router.map() has already been called');
  }

  if ( !list[parentRouteName] )
  {
    list[parentRouteName] = [];
  }

  list[parentRouteName].push(callback);
}


export function applyRoutes(name) {
  //console.log('applyRoutes', name);
  if ( !list )
  {
    throw new Error('Cannot applyRoutes after Router.map() has already been called');
  }

  if( list[name] )
  {
    return function() {
      list[name].forEach(function(fn) {
        fn.apply(this);
      }, this);
    };
  }

  return null;
}

// Clear the route list once it's no longer needed, and prevent future calls to try to
// add more routes (which won't work anwyay, because Router.map() has already run.
export function clearRoutes() {
  //console.log('clearRoutes()');
  list = null;
}

export function composeRouteCallbacks(additionalCallback, standardCallback) {
  if ( !additionalCallback && !standardCallback ) {
    return null;
  }

  return function() {
    installAdditionalRouteSupport(this);
    if ( additionalCallback ) {
      additionalCallback.apply(this);
    }
    if ( standardCallback ) {
      standardCallback.apply(this);
    }
  };
}

// Instrument only the Router.map DSL instance and each child DSL it creates.
// This keeps addon route composition without mutating Ember's global prototype.
export function installAdditionalRouteSupport(dsl) {
  if ( !dsl || typeof dsl.route !== 'function' ) {
    throw new TypeError('A Router.map DSL instance is required');
  }
  if ( instrumentedRouteDsl.has(dsl) ) {
    return dsl;
  }

  const originalRoute = dsl.route;
  dsl.route = function(name, options, callback) {
    if ( arguments.length === 1 ) {
      options = {};
    } else if ( arguments.length === 2 && typeof options === 'function' ) {
      callback = options;
      options = {};
    } else {
      options = options || {};
    }

    const key = `${this.parent}.${name}`;
    const combinedCallback = composeRouteCallbacks(applyRoutes(key), callback);
    if ( combinedCallback ) {
      return originalRoute.call(this, name, options, combinedCallback);
    }
    return originalRoute.call(this, name, options);
  };

  instrumentedRouteDsl.add(dsl);
  return dsl;
}

