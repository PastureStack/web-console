import MfaSecurityConfirmation from 'ui/components/mfa-security-confirmation/component';
import layout from 'ui/components/mfa-security-confirmation/template';

// Keep the controlled key draft mounted while a one-time, digest-bound factor
// is confirmed. Reuse the platform MFA methods and translated form.
export default MfaSecurityConfirmation.extend({
  layout,
  classNames: ['api-key-confirmation', 'well'],
  opts: null,
  keyUp() {},

  begin() {
    return this.request(Object.assign({operation: 'beginSecurityConfirmation'}, this.confirmationBinding())).then((challenge) => {
      if ( this.isDestroyed || this.isDestroying ) { return; }
      this.setProperties({challenge, method: null, waiting: false});
      this.set('method', (this.get('availableMethods') || [])[0] || null);
    }).catch((error) => {
      if ( !this.isDestroyed && !this.isDestroying ) { this.showError(error); }
    });
  },

  finish(webAuthnResponse) {
    this.setProperties({waiting: true, errorMessage: null});
    return this.request(Object.assign({
      operation: 'confirmSecurityConfirmation',
      challengeId: this.get('challenge.challengeId'),
      method: this.get('method'),
      verificationCode: this.get('verificationCode'),
      recoveryCode: this.get('recoveryCode'),
      webAuthnResponse,
    }, this.confirmationBinding())).then((result) => {
      this.setProperties({verificationCode: '', recoveryCode: ''});
      return this.get('opts.onComplete')(result.securityConfirmation);
    }).catch((error) => {
      if ( !this.isDestroyed && !this.isDestroying ) { this.showError(error); }
    });
  },

  actions: {
    cancelConfirmation() {
      this.setProperties({verificationCode: '', recoveryCode: ''});
      this.get('opts.onCancel')();
    },
  },
});
