var list = {};

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

