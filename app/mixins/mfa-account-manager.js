import Ember from 'ember';
import { register as registerPasskey } from 'ui/utils/webauthn';
import { totpProvisioningQr } from 'ui/utils/totp-qr';

export default Ember.Mixin.create({
  access: Ember.inject.service(),
  intl: Ember.inject.service(),
  session: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  busy: false,
  errors: null,
  selectedAccountId: null,
  factors: null,
  status: null,
  totpEnrollment: null,
  totpLabel: '',
  totpCode: '',
  passkeyLabel: '',
  recoveryCodes: null,
  recoveryEmail: '',
  recoveryEmailEnrollment: null,
  recoveryEmailCode: '',
  reauthenticationRequired: false,

  recoveryCodesText: function() {
    return (this.get('recoveryCodes') || []).join('\n');
  }.property('recoveryCodes.[]'),

  isCurrentAccount: function() {
    return this.get('selectedAccountId') === this.get('session.accountId');
  }.property('selectedAccountId', 'session.accountId'),

  webAuthnPolicyConfigured: Ember.computed.alias('status.webAuthnConfigured'),

  webAuthnEnvironmentSupported: function() {
    return typeof window !== 'undefined' && window.isSecureContext &&
      typeof window.PublicKeyCredential !== 'undefined';
  }.property('status.webAuthnConfigured'),

  webAuthnReady: function() {
    return this.get('webAuthnPolicyConfigured') && this.get('webAuthnEnvironmentSupported');
  }.property('webAuthnPolicyConfigured', 'webAuthnEnvironmentSupported'),

  totpQrSvg: function() {
    let uri = this.get('totpEnrollment.totpProvisioningUri');
    if ( !uri ) {
      return null;
    }

    return totpProvisioningQr(uri, this.get('intl').t('authPage.mfa.totp.qrAlt'));
  }.property('totpEnrollment.totpProvisioningUri', 'intl._locale'),

  actions: {
    beginTotp() {
      return this.runOperation({operation: 'beginTotpEnrollment'}).then((result) => {
        this.setProperties({totpEnrollment: result, totpCode: ''});
      }).catch((err) => this.handleError(err));
    },

    confirmTotp() {
      return this.runOperation({
        operation: 'confirmTotpEnrollment',
        challengeId: this.get('totpEnrollment.challengeId'),
        verificationCode: this.get('totpCode'),
        label: this.get('totpLabel') || this.get('intl').t('authPage.mfa.totp.defaultLabel'),
      }).then((result) => {
        this.setProperties({
          totpEnrollment: null,
          totpLabel: '',
          totpCode: '',
          recoveryCodes: result.recoveryCodes || null,
        });
        return this.reloadAccount();
      }).catch((err) => this.handleError(err));
    },

    cancelTotp() {
      this.setProperties({
        totpEnrollment: null,
        totpLabel: '',
        totpCode: '',
      });
    },

    beginPasskey() {
      return this.runOperation({
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
      return this.runOperation({operation: 'regenerateRecoveryCodes'}).then((result) => {
        this.set('recoveryCodes', result.recoveryCodes || []);
        if ( this.get('status') ) {
          this.set('status.recoveryCodesRemaining', (result.recoveryCodes || []).length);
        }
        return this.afterSessionRevocation();
      }).catch((err) => this.handleError(err));
    },

    dismissRecoveryCodes() {
      this.set('recoveryCodes', null);
      if ( this.get('reauthenticationRequired') ) {
        this.send('signInAgain');
      }
    },

    beginRecoveryEmail() {
      return this.runOperation({
        operation: 'beginRecoveryEmailEnrollment',
        email: this.get('recoveryEmail'),
      }).then((result) => {
        this.setProperties({
          recoveryEmailEnrollment: result,
          recoveryEmailCode: '',
        });
      }).catch((err) => this.handleError(err));
    },

    confirmRecoveryEmail() {
      return this.runOperation({
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
      }).catch((err) => this.handleError(err));
    },

    revokeRecoveryEmail() {
      if ( window.confirm(this.get('intl').t('authPage.mfa.email.confirmRevoke')) ) {
        return this.runOperation({operation: 'revokeRecoveryEmail'})
          .then(() => this.afterSessionRevocation())
          .catch((err) => this.handleError(err));
      }
    },

    revokeFactor(factor) {
      if ( window.confirm(this.get('intl').t('authPage.mfa.factor.confirmRevoke',
        {label: factor.get('label')})) ) {
        return this.runOperation({
          operation: 'revokeFactor',
          factorId: factor.get('id'),
        }).then(() => this.afterSessionRevocation())
          .catch((err) => this.handleError(err));
      }
    },

    signInAgain() {
      this.get('access').clearSessionKeys();
      this.transitionToRoute('login');
    },
  },

  resetMfaAccountState(accountId, factors, status) {
    this.setProperties({
      selectedAccountId: accountId,
      factors: factors,
      status: status,
      errors: null,
      busy: false,
      totpEnrollment: null,
      totpLabel: '',
      totpCode: '',
      passkeyLabel: '',
      recoveryCodes: null,
      recoveryEmail: '',
      recoveryEmailEnrollment: null,
      recoveryEmailCode: '',
      reauthenticationRequired: false,
    });
  },

  runOperation(data) {
    this.setProperties({busy: true, errors: null});
    return this.get('userStore').rawRequest({
      url: 'mfaOperation',
      method: 'POST',
      data: Object.assign({accountId: this.get('selectedAccountId')}, data),
    }).then((xhr) => xhr.body).finally(() => this.set('busy', false));
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
