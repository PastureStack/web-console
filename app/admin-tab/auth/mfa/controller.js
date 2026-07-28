import Ember from 'ember';
import { register as registerPasskey } from 'ui/utils/webauthn';

export default Ember.Controller.extend({
  access: Ember.inject.service(),
  intl: Ember.inject.service(),
  session: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  busy: false,
  errors: null,
  selectedAccountId: null,
  factors: null,
  status: null,
  settingsForm: null,
  totpEnrollment: null,
  totpCode: '',
  passkeyLabel: '',
  recoveryCodes: null,
  recoveryEmail: '',
  recoveryEmailEnrollment: null,
  recoveryEmailCode: '',
  reauthenticationRequired: false,
  testRecipient: '',

  accountChoices: function() {
    return (this.get('model.accounts') || []).filter((account) => {
      return ['service', 'agent', 'project'].indexOf(account.get('kind')) < 0 &&
        account.get('state') === 'active';
    }).map((account) => {
      return {
        label: `${account.get('name') || account.get('id')} (${account.get('kind')})`,
        value: account.get('id'),
      };
    });
  }.property('model.accounts.@each.{name,kind,state}'),

  isCurrentAccount: function() {
    return this.get('selectedAccountId') === this.get('session.accountId');
  }.property('selectedAccountId', 'session.accountId'),

  hasRecoveryEmail: Ember.computed.bool('status.recoveryEmailMasked'),
  webAuthnReady: Ember.computed.alias('status.webAuthnConfigured'),

  enforcementChoices: [
    {label: 'authPage.mfa.settings.optional', value: 'optional'},
    {label: 'authPage.mfa.settings.requiredAdmins', value: 'requiredAdmins'},
    {label: 'authPage.mfa.settings.requiredAll', value: 'requiredAll'},
  ],

  actions: {
    selectAccount(selection) {
      let accountId = selection && selection.value;
      this.set('selectedAccountId', accountId);
      this.reloadAccount();
    },

    beginTotp() {
      this.runOperation({operation: 'beginTotpEnrollment'}).then((result) => {
        this.setProperties({totpEnrollment: result, totpCode: ''});
      });
    },

    confirmTotp() {
      this.runOperation({
        operation: 'confirmTotpEnrollment',
        challengeId: this.get('totpEnrollment.challengeId'),
        verificationCode: this.get('totpCode'),
        label: this.get('totpLabel') || this.get('intl').t('authPage.mfa.totp.defaultLabel'),
      }).then((result) => {
        this.setProperties({
          totpEnrollment: null,
          totpCode: '',
          recoveryCodes: result.recoveryCodes || null,
        });
        return this.reloadAccount();
      });
    },

    beginPasskey() {
      this.runOperation({
        operation: 'beginPasskeyEnrollment',
        label: this.get('passkeyLabel') || this.get('intl').t('authPage.mfa.passkey.defaultLabel'),
      }).then((result) => {
        return registerPasskey(result.publicKey).then((response) => {
          return this.runOperation({
            operation: 'confirmPasskeyEnrollment',
            challengeId: result.challengeId,
            webAuthnResponse: response,
            label: this.get('passkeyLabel') || this.get('intl').t('authPage.mfa.passkey.defaultLabel'),
          });
        });
      }).then((result) => {
        this.setProperties({
          passkeyLabel: '',
          recoveryCodes: result.recoveryCodes || this.get('recoveryCodes'),
        });
        return this.reloadAccount();
      }).catch((err) => this.handleError(err));
    },

    regenerateRecoveryCodes() {
      if ( !window.confirm(this.get('intl').t('authPage.mfa.recoveryCodes.confirm')) ) {
        return;
      }
      this.runOperation({operation: 'regenerateRecoveryCodes'}).then((result) => {
        this.set('recoveryCodes', result.recoveryCodes || []);
        if ( this.get('status') ) {
          this.set('status.recoveryCodesRemaining', (result.recoveryCodes || []).length);
        }
        return this.afterSessionRevocation();
      });
    },

    copyRecoveryCodes() {
      let text = (this.get('recoveryCodes') || []).join('\n');
      if ( navigator.clipboard && window.isSecureContext ) {
        navigator.clipboard.writeText(text);
      }
    },

    dismissRecoveryCodes() {
      this.set('recoveryCodes', null);
      if ( this.get('reauthenticationRequired') ) {
        this.send('signInAgain');
      }
    },

    beginRecoveryEmail() {
      this.runOperation({
        operation: 'beginRecoveryEmailEnrollment',
        email: this.get('recoveryEmail'),
      }).then((result) => {
        this.setProperties({
          recoveryEmailEnrollment: result,
          recoveryEmailCode: '',
        });
      });
    },

    confirmRecoveryEmail() {
      this.runOperation({
        operation: 'confirmRecoveryEmailEnrollment',
        challengeId: this.get('recoveryEmailEnrollment.challengeId'),
        emailCode: this.get('recoveryEmailCode'),
      }).then(() => {
        this.setProperties({
          recoveryEmail: '',
          recoveryEmailEnrollment: null,
          recoveryEmailCode: '',
        });
        return this.afterSessionRevocation();
      });
    },

    revokeRecoveryEmail() {
      if ( window.confirm(this.get('intl').t('authPage.mfa.email.confirmRevoke')) ) {
        this.runOperation({operation: 'revokeRecoveryEmail'}).then(() => this.afterSessionRevocation());
      }
    },

    revokeFactor(factor) {
      if ( window.confirm(this.get('intl').t('authPage.mfa.factor.confirmRevoke',
        {label: factor.get('label')})) ) {
        this.runOperation({
          operation: 'revokeFactor',
          factorId: factor.get('id'),
        }).then(() => this.afterSessionRevocation());
      }
    },

    revokeAllFactors() {
      if ( window.confirm(this.get('intl').t('authPage.mfa.factor.confirmRevokeAll')) ) {
        this.runOperation({operation: 'revokeAllFactors'}).then(() => this.afterSessionRevocation());
      }
    },

    signInAgain() {
      this.get('access').clearSessionKeys();
      this.transitionToRoute('login');
    },

    saveSettings(sendTestEmail) {
      let form = this.get('settingsForm');
      let data = form.getProperties(
        'enforcement', 'passkeyLimit', 'relyingPartyId', 'origin', 'relyingPartyName',
        'issuer', 'smtpEnabled', 'smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword',
        'smtpClearPassword', 'smtpFrom', 'smtpStartTls', 'smtpSsl', 'smtpConnectionTimeoutMillis',
        'smtpReadTimeoutMillis', 'emailCodeTtlSeconds'
      );
      data.sendTestEmail = !!sendTestEmail;
      data.testRecipient = this.get('testRecipient');
      this.setProperties({busy: true, errors: null});
      this.get('userStore').rawRequest({
        url: 'mfaSettings',
        method: 'POST',
        data: data,
      }).then(() => {
        form.set('smtpPassword', '');
        return this.reloadSettings();
      }).catch((err) => this.handleError(err)).finally(() => this.set('busy', false));
    },
  },

  runOperation(data) {
    this.setProperties({busy: true, errors: null});
    return this.get('userStore').rawRequest({
      url: 'mfaOperation',
      method: 'POST',
      data: Object.assign({accountId: this.get('selectedAccountId')}, data),
    }).then((xhr) => xhr.body).catch((err) => {
      this.handleError(err);
      return Ember.RSVP.reject(err);
    }).finally(() => this.set('busy', false));
  },

  reloadAccount() {
    let accountId = this.get('selectedAccountId');
    return Ember.RSVP.hash({
      factors: this.get('userStore').find('mfaFactor', null, {
        filter: {accountId: accountId}, forceReload: true,
      }),
      status: this.get('userStore').find('mfaStatus', null, {
        filter: {accountId: accountId}, forceReload: true,
      }),
    }).then((result) => {
      this.setProperties({
        factors: result.factors,
        status: result.status.get('firstObject'),
      });
    }).catch((err) => this.handleError(err));
  },

  reloadSettings() {
    return this.get('userStore').find('mfaSettings', null, {forceReload: true}).then((items) => {
      let settings = items.get('firstObject');
      this.set('settingsForm', Ember.Object.create(settings ? settings.serialize() : {}));
    });
  },

  afterSessionRevocation() {
    if ( this.get('isCurrentAccount') ) {
      this.set('reauthenticationRequired', true);
      return Ember.RSVP.resolve();
    }
    return this.reloadAccount();
  },

  handleError(err) {
    let message = err && err.message ? err.message : this.get('intl').t('authPage.mfa.error.generic');
    if ( message === 'WebAuthnUnavailable' ) {
      message = this.get('intl').t('authPage.mfa.error.secureContext');
    }
    this.setProperties({errors: [message], busy: false});
  },
});
