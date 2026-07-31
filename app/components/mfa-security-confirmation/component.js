import { scheduleOnce } from '@ember/runloop';
import { alias, equal, empty, or } from '@ember/object/computed';
import { service } from '@ember/service';
import ModalBase from 'lacsso/components/modal-base';
import {
  authenticate as authenticateWithPasskey,
  isAvailable as isWebAuthnAvailable,
} from 'ui/utils/webauthn';
import { localizedMfaError } from 'ui/utils/mfa-error';

import { computed } from '@ember/object';

export default ModalBase.extend({
  classNames: ['lacsso', 'modal-container', 'medium-modal'],

  intl: service(),
  userStore: service('user-store'),

  opts: alias('modalService.modalOpts'),
  challenge: null,
  method: null,
  verificationCode: '',
  recoveryCode: '',
  waiting: true,
  errorMessage: null,

  isTotp: equal('method', 'totp'),
  isPasskey: equal('method', 'webauthn'),
  isRecoveryCode: equal('method', 'recoveryCode'),
  noAvailableMethod: empty('method'),
  confirmDisabled: or('waiting', 'noAvailableMethod'),

  webAuthnEnvironmentSupported: computed(function() {
    return isWebAuthnAvailable();
  }),

  availableMethods: computed('challenge.methods.[]', 'webAuthnEnvironmentSupported', function() {
    let webAuthnSupported = this.get('webAuthnEnvironmentSupported');
    return (this.get('challenge.methods') || []).filter((method) => {
      return webAuthnSupported || method !== 'webauthn';
    });
  }),

  hasUnavailablePasskeyMethod: computed('challenge.methods.[]', 'webAuthnEnvironmentSupported', function() {
    return !this.get('webAuthnEnvironmentSupported') &&
      (this.get('challenge.methods') || []).indexOf('webauthn') >= 0;
  }),

  didInsertElement() {
    this._super(...arguments);
    scheduleOnce('afterRender', this, this.begin);
  },

  begin() {
    return this.request({
      operation: 'beginSecurityConfirmation',
    }).then((challenge) => {
      this.setProperties({
        challenge: challenge,
        method: null,
        waiting: false,
      });
      this.set('method', (this.get('availableMethods') || [])[0] || null);
    }).catch((err) => this.showError(err));
  },

  request(data) {
    return this.get('userStore').rawRequest({
      url: 'mfaOperation',
      method: 'POST',
      data: data,
    }).then((xhr) => xhr.body);
  },

  finish(webAuthnResponse) {
    let challenge = this.get('challenge');
    this.setProperties({waiting: true, errorMessage: null});
    return this.request({
      operation: 'confirmSecurityConfirmation',
      challengeId: challenge.challengeId,
      method: this.get('method'),
      verificationCode: this.get('verificationCode'),
      recoveryCode: this.get('recoveryCode'),
      webAuthnResponse: webAuthnResponse,
    }).then((result) => {
      let onComplete = this.get('opts.onComplete');
      if ( typeof onComplete === 'function' ) {
        onComplete(result.securityConfirmation);
      }
      this.get('modalService').toggleModal();
    }).catch((err) => this.showError(err));
  },

  showError(err) {
    this.setProperties({
      waiting: false,
      verificationCode: '',
      recoveryCode: '',
      errorMessage: localizedMfaError(
        err, this.get('intl'), 'authPage.mfa.securityConfirmation.error'
      ),
    });
  },

  actions: {
    selectMethod(method) {
      this.setProperties({
        method: method,
        verificationCode: '',
        recoveryCode: '',
        errorMessage: null,
      });
    },

    confirm() {
      if ( this.get('isPasskey') ) {
        this.setProperties({waiting: true, errorMessage: null});
        authenticateWithPasskey(this.get('challenge.webAuthnOptions')).then((response) => {
          return this.finish(response);
        }).catch((err) => this.showError(err));
        return;
      }
      this.finish(null);
    },

    cancelConfirmation() {
      let onCancel = this.get('opts.onCancel');
      if ( typeof onCancel === 'function' ) {
        onCancel();
      }
      this.get('modalService').toggleModal();
    },
  },
});
