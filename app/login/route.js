import { service } from '@ember/service';
import Route from '@ember/routing/route';

export function shibbolethTestRequested(transition) {
  return !!(transition && transition.queryParams && transition.queryParams.shibbolethTest);
}

export default Route.extend({
  access: service(),
  language: service('user-language'),

  beforeModel(transition) {
    this._super.apply(this,arguments);
    return this.get('language').initUnauthed().then(() => {
      if ( !this.get('access.enabled') && !shibbolethTestRequested(transition))
      {
        this.get('router').transitionTo('authenticated');
      }
    });
  },
});
