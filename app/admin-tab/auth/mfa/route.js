import Ember from 'ember';

export default Ember.Route.extend({
  session: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  model() {
    let accountId = this.get('session.accountId');
    return Ember.RSVP.hash({
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
    controller.setProperties({
      selectedAccountId: this.get('session.accountId'),
      factors: model.factors,
      status: model.status.get('firstObject'),
      settingsForm: Ember.Object.create(settings ? settings.serialize() : {}),
      errors: null,
      busy: false,
      totpEnrollment: null,
      totpCode: '',
      passkeyLabel: '',
      recoveryCodes: null,
      recoveryEmail: '',
      recoveryEmailEnrollment: null,
      recoveryEmailCode: '',
      reauthenticationRequired: false,
      testRecipient: '',
    });
  },
});
