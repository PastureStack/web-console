import { reject, Promise, hash, resolve } from 'rsvp';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Mixin from '@ember/object/mixin';
import {
  isAvailable as isWebAuthnAvailable,
  register as registerPasskey,
} from 'ui/utils/webauthn';
import { totpProvisioningQr } from 'ui/utils/totp-qr';
import { localizedMfaError, mfaErrorCode } from 'ui/utils/mfa-error';

export default Mixin.create({
  access: service(),
  intl: service(),
  modalService: service('modal'),
  session: service(),
  userStore: service('user-store'),

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

  webAuthnPolicyConfigured: alias('status.webAuthnConfigured'),

  webAuthnEnvironmentSupported: function() {
    return isWebAuthnAvailable();
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
      return this.runSensitiveOperation({operation: 'beginTotpEnrollment'}).then((result) => {
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
      return this.runSensitiveOperation({
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
      return this.runSensitiveOperation({operation: 'regenerateRecoveryCodes'}).then((result) => {
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
      return this.runSensitiveOperation({
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
        return this.runSensitiveOperation({operation: 'revokeRecoveryEmail'})
          .then(() => this.afterSessionRevocation())
          .catch((err) => this.handleError(err));
      }
    },

    revokeFactor(factor) {
      if ( window.confirm(this.get('intl').t('authPage.mfa.factor.confirmRevoke',
        {label: factor.get('label')})) ) {
        return this.runSensitiveOperation({
          operation: 'revokeFactor',
          factorId: factor.get('id'),
        }).then(() => this.afterSessionRevocation())
          .catch((err) => this.handleError(err));
      }
    },

    signInAgain() {
      this.get('access').clearSessionKeys();
      this.get('router').transitionTo('login');
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

  runSensitiveOperation(data) {
    return this.withSecurityConfirmation((confirmation) => {
      let payload = Object.assign({}, data);
      if ( confirmation ) {
        payload.securityConfirmation = confirmation;
      }
      return this.runOperation(payload);
    });
  },

  withSecurityConfirmation(executor) {
    return executor(null).catch((err) => {
      if ( mfaErrorCode(err) !== 'MfaReauthenticationRequired' ) {
        return reject(err);
      }

      return new Promise((resolve, reject) => {
        this.get('modalService').toggleModal('mfa-security-confirmation', {
          closeWithOutsideClick: false,
          escToClose: false,
          onComplete: (confirmation) => {
            executor(confirmation).then(resolve, reject);
          },
          onCancel: () => reject({mfaConfirmationCancelled: true}),
        });
      });
    });
  },

  reloadAccount() {
    let accountId = this.get('selectedAccountId');
    return hash({
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
      return resolve();
    }
    return this.reloadAccount();
  },

  handleError(err) {
    if ( err && err.mfaConfirmationCancelled ) {
      this.set('busy', false);
      return;
    }
    let message = localizedMfaError(
      err, this.get('intl'), 'authPage.mfa.error.generic'
    );
    this.setProperties({errors: [message], busy: false});
  },
});
