import { all } from 'rsvp';
import Route from '@ember/routing/route';

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
        });
      })).then(() => accounts);
    });
  },
});
