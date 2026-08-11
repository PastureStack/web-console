import Ember from 'ember';

export default Ember.Route.extend({
  session: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  queryParams: {
    accountId: {
      refreshModel: true,
      replace: true,
    },
  },

  model(params) {
    let accountId = params.accountId || this.get('session.accountId');
    return Ember.RSVP.hash({
      selectedAccountId: accountId,
      accounts: this.get('userStore').find('account', null, {
        filter: {'kind_ne': ['service', 'agent', 'project']},
        forceReload: true,
      }),
      factors: this.get('userStore').find('mfaFactor', null, {
        filter: {accountId: accountId},
        forceReload: true,
      }),
      settings: this.get('userStore').find('mfaSettings', null, {forceReload: true}),
      status: this.get('userStore').find('mfaStatus', null, {
        filter: {accountId: accountId},
        forceReload: true,
      }),
    });
  },

  setupController(controller, model) {
    this._super(controller, model);
    let settings = model.settings.get('firstObject');
    controller.resetMfaAccountState(
      model.selectedAccountId,
      model.factors,
      model.status.get('firstObject')
    );
    controller.setProperties({
      settingsForm: Ember.Object.create(settings ? settings.serialize() : {}),
      testRecipient: '',
    });
  },
});
