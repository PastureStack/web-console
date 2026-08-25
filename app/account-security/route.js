import { hash } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  session: service(),
  userStore: service('user-store'),

  model() {
    let accountId = this.get('session.accountId');
    return hash({
      accountId: accountId,
      factors: this.get('userStore').find('mfaFactor', null, {
        filter: {accountId: accountId},
        forceReload: true,
      }),
      status: this.get('userStore').find('mfaStatus', null, {
        filter: {accountId: accountId},
        forceReload: true,
      }),
    });
  },

  setupController(controller, model) {
    this._super(controller, model);
    controller.resetMfaAccountState(
      model.accountId,
      model.factors,
      model.status.get('firstObject')
    );
  },
});
