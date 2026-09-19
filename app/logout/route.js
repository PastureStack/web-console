import { service } from '@ember/service';
import Route from '@ember/routing/route';
import Errors from 'ui/utils/errors';

export default Route.extend({
  access: service(),

  beforeModel: function(transition) {
    // A direct navigation or a manual refresh starts with no in-memory tab
    // ownership, even though the shared cookie and generation are valid.  An
    // explicit logout must first validate and adopt that session; otherwise
    // the ownership guard correctly treats this tab as stale and leaves the
    // user logged in.  A missing session is already effectively logged out.
    return this.get('access').ensureSession().catch((error) => {
      if ( Errors.status(error) !== 401 ) {
        throw error;
      }
    }).then(() => {
      // Keep the transition pending until the generation-bound DELETE has
      // settled and the application route has selected the next safe route.
      return transition.send('logout');
    });
  }
});
