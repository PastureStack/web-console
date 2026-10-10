import { hash, resolve } from 'rsvp';
import Route from '@ember/routing/route';
import C from 'ui/utils/constants';

export default Route.extend({
  model: function() {
    var me = this.get(`session.${C.SESSION.ACCOUNT_ID}`);
    let userStore = this.get('userStore');
    let schema = userStore.getById('schema', 'apikeyrestricted');
    return hash({
      account: userStore.findAll('apikey', null, {filter: {accountId: me}, url: 'apikeys', forceReload: true}),
      accountRestricted: schema ? userStore.findAll('apikeyrestricted', null, {
        filter: {accountId: me}, forceReload: true,
      }) : resolve([]),
      environment: this.get('store').findAll('apikey', null, {forceReload: true}),
    });
  },
});
