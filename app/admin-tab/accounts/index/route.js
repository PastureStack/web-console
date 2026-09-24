import { all } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import Errors from 'ui/utils/errors';
import resourceLoadError from 'ui/utils/resource-load-error';
import isDisplayedAccount from 'ui/utils/is-displayed-account';

export default Route.extend({
  intl: service(),

  model: function() {
    return this.get('userStore').find('password').then(() => {
      return this.get('userStore').find('account', null, {filter: {'kind_ne': ['service','agent']}, forceReload: true});
    }).then((accounts) => {
      // The account collection also contains project accounts (including
      // Default), but the identity-link resource only accepts user/admin
      // accounts.  Query exactly the rows this page displays.
      return all(accounts.filter(isDisplayedAccount).map((account) => {
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
          let code = error && (typeof error.get === 'function' ? error.get('code') : error.code);
          if ( account.get('state') === 'inactive' &&
               Errors.status(error) === 404 && code === 'AccountNotFound' ) {
            account.set('_authIdentityLinks', []);
            return account;
          }
          throw error;
        });
      })).then(() => accounts);
    }).then(null, (err) => {
      throw resourceLoadError(err, this.get('intl'),
        'resourceLoadError.accountsUnavailable', 'resourceLoadError.accountsFailed');
    });
  },
});
