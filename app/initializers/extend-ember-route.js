import { getOwner } from '@ember/application';
import Route from '@ember/routing/route';

export function routeInfoArguments(routeInfo) {
  let chain = [];
  let current = routeInfo;

  while ( current ) {
    chain.unshift(current);
    current = current.parent;
  }

  return chain.reduce((out, info) => {
    (info.paramNames || []).forEach((name) => {
      out.push((info.params || {})[name]);
    });

    return out;
  }, []);
}

export function parentRouteInfo(routeInfo) {
  if ( !routeInfo ) {
    return null;
  }

  let parent = routeInfo.parent;

  if ( parent && routeInfo.name === `${parent.name}.index` ) {
    parent = parent.parent;
  }

  return parent || null;
}

export function initialize() {
  Route.reopen({

    // Remember the currently settled route before a new route begins loading.
    beforeModel: function() {
      this._super.apply(this, arguments);
      this.rememberPrevious();
    },

    rememberPrevious: function() {
      let appRoute = getOwner(this).lookup('route:application');
      let routeInfo = this.get('router.currentRoute');

      if ( routeInfo && !routeInfo.name.match(/\.?loading$/) ) {
        appRoute.set('previousRoute', routeInfo.name);
        appRoute.set('previousParams', routeInfoArguments(routeInfo));
      }
    },

    goToPrevious: function(def) {
      let appRoute = getOwner(this).lookup('route:application');
      let route = appRoute.get('previousRoute');

      if ( !route || route === 'loading' ) {
        if ( def ) {
          return this.get('router').transitionTo(def);
        }

        return this.goToParent();
      }

      let args = (appRoute.get('previousParams') || []).slice();

      args.unshift(route);

      return this.get('router').transitionTo(...args).catch(() => {
        return this.get('router').transitionTo('authenticated');
      });
    },

    goToParent: function() {
      let routeInfo = parentRouteInfo(this.get('router.currentRoute'));

      if ( !routeInfo ) {
        return this.get('router').transitionTo('authenticated');
      }

      let args = routeInfoArguments(routeInfo);

      args.unshift(routeInfo.name);

      return this.get('router').transitionTo(...args).catch(() => {
        return this.get('router').transitionTo('authenticated');
      });
    },
  });
}

export default {
  name: 'extend-ember-route',
  initialize: initialize
};
