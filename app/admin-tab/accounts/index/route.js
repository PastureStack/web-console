import { all } from 'rsvp';
import Route from '@ember/routing/route';
import Errors from 'ui/utils/errors';

export default Route.extend({
  model: function() {
    return this.get('userStore').find('password').then(() => {
      return this.get('userStore').find('account', null, {filter: {'kind_ne': ['service','agent']}, forceReload: true});
    }).then((accounts) => {
      return all(accounts.map((account) => {
        return this.get('userStore').find('authIdentityLink', null, {
          filter: {accountId: account.get('id')},
          forceReload: true,
        }).then((links) => {
          account.set('_authIdentityLinks', links);
          return account;
        }, (error) => {
          // Account listings intentionally include inactive historical rows,
          // while the identity-link API rejects a row whose account is no
          // longer active with AccountNotFound.  Keep that one row visible and
          // let account-row use its embedded identity fields; one stale row
          // must not make the entire administration page fail.  Other errors
          // remain fatal so authorization and backend outages are not hidden.
          if ( Errors.status(error) === 404 ) {
            account.set('_authIdentityLinks', []);
            return account;
          }
          throw error;
        });
      })).then(() => accounts);
    });
  },
});
