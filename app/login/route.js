import { service } from '@ember/service';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';
import { isAuthenticationPath, safeInternalTarget } from 'ui/utils/auth-navigation';

export function shibbolethTestRequested(transition) {
  return !!(transition && transition.queryParams && transition.queryParams.shibbolethTest);
}

export default Route.extend({
  access: service(),
  language: service('user-language'),
  session: service(),

  beforeModel(transition) {
    this._super.apply(this,arguments);
    return this.get('language').initUnauthed().then(() => {
      if ( !this.get('access.enabled') && !shibbolethTestRequested(transition))
      {
        this.get('router').transitionTo('authenticated');
        return;
      }

      let query = transition && transition.queryParams || {};
      let oidcCallback = transition && transition.targetName === 'login.oidc-auth' &&
        (query.code || query.error || query.oidcError);
      if ( oidcCallback ) {
        // The callback carries its own captured login generation and the
        // application route rejects it if a newer session already committed.
        return;
      }

      // A tab can enter /login just before another tab commits a valid
      // session.  Rebuild ownership from the shared cookie on every login
      // entry so a missed storage/channel event never leaves it stranded.
      return this.get('access').ensureSession().then(() => {
        let target = safeInternalTarget(this.get(`session.${C.SESSION.BACK_TO}`));
        if ( target && !isAuthenticationPath(target) ) {
          window.location.replace(target);
        } else {
          this.get('router').replaceWith('authenticated');
        }
      }, (error) => {
        let status = Errors.status(error);
        if ( status === 401 || status === 409 ) {
          return;
        }
        throw error;
      });
    });
  },
});
