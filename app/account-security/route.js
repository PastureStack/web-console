import Ember from 'ember';

export default Ember.Route.extend({
  session: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  model() {
    let accountId = this.get('session.accountId');
    return Ember.RSVP.hash({
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
