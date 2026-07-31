import Ember from 'ember';
import {
  authenticate as authenticateWithPasskey,
  isAvailable as isWebAuthnAvailable,
  register as registerPasskey,
} from 'ui/utils/webauthn';
import { totpProvisioningQr } from 'ui/utils/totp-qr';
import { localizedMfaError } from 'ui/utils/mfa-error';

export default Ember.Controller.extend({
  queryParams       : ['timedOut','errorMsg'],
  access            : Ember.inject.service(),
  settings          : Ember.inject.service(),
  intl              : Ember.inject.service(),

  isGithub          : Ember.computed.equal('access.provider', 'githubconfig'),
  isActiveDirectory : Ember.computed.equal('access.provider', 'ldapconfig'),
  isOpenLdap        : Ember.computed.equal('access.provider', 'openldapconfig'),
  isLocal           : Ember.computed.equal('access.provider', 'localauthconfig'),
  isOidc            : Ember.computed.equal('access.provider', 'oidcconfig'),
  isAzureAd         : Ember.computed.equal('access.provider', 'azureadconfig'),
  isShibboleth      : Ember.computed.equal('access.provider', 'shibbolethconfig'),

  timedOut          : false,
  waiting           : false,
  errorMsg          : null,
  useLocalRecovery  : false,
  selectedMfaMethod : null,
  mfaCode           : '',
  recoveryCode      : '',
  emailCode         : '',
  newRecoveryCodes  : null,
  showMfaRecoveryOptions : false,

  canLocalRecovery: Ember.computed.alias('access.token.localRecoveryEnabled'),
  mfaChallenge: Ember.computed.alias('access.mfaChallenge'),
  isMfaPending: Ember.computed.bool('mfaChallenge.mfaRequired'),
  emailCodeSent: Ember.computed.alias('mfaChallenge.emailCodeSent'),
  hasNewRecoveryCodes: Ember.computed.notEmpty('newRecoveryCodes'),
  recoveryCodesText: function() {
    return (this.get('newRecoveryCodes') || []).join('\n');
  }.property('newRecoveryCodes.[]'),

  webAuthnEnvironmentSupported: function() {
    return isWebAuthnAvailable();
  }.property(),

  availableMfaMethods: function() {
    return this._availableMfaMethods(this.get('mfaChallenge.mfaMethods') || []);
  }.property('mfaChallenge.mfaMethods.[]', 'webAuthnEnvironmentSupported'),

  hasUnavailablePasskeyMethod: function() {
    let methods = this.get('mfaChallenge.mfaMethods') || [];
    return !this.get('webAuthnEnvironmentSupported') && methods.some((method) => {
      return ['webauthn', 'webauthnEnrollment'].indexOf(method) >= 0;
    });
  }.property('mfaChallenge.mfaMethods.[]', 'webAuthnEnvironmentSupported'),

  primaryMfaMethods: function() {
    return (this.get('availableMfaMethods') || []).filter((method) => {
      return ['recoveryCode', 'emailRecovery'].indexOf(method) < 0;
    });
  }.property('availableMfaMethods.[]'),

  recoveryMfaMethods: function() {
    return (this.get('availableMfaMethods') || []).filter((method) => {
      return ['recoveryCode', 'emailRecovery'].indexOf(method) >= 0;
    });
  }.property('availableMfaMethods.[]'),

  hasMfaRecoveryMethods: function() {
    return this.get('recoveryMfaMethods.length') > 0;
  }.property('recoveryMfaMethods.length'),

  activeMfaMethod: function() {
    let methods = this.get('availableMfaMethods') || [];
    let selected = this.get('selectedMfaMethod');
    let primary = this.get('primaryMfaMethods') || [];
    return methods.indexOf(selected) >= 0 ? selected : (primary[0] || methods[0]);
  }.property('mfaChallenge.mfaMethods.[]', 'primaryMfaMethods.[]', 'selectedMfaMethod'),

  isMfaTotp: Ember.computed('activeMfaMethod', function() {
    return ['totp', 'totpEnrollment'].indexOf(this.get('activeMfaMethod')) >= 0;
  }),
  isMfaEnrollment: Ember.computed.equal('activeMfaMethod', 'totpEnrollment'),
  isMfaPasskey: function() {
    return ['webauthn', 'webauthnEnrollment'].indexOf(this.get('activeMfaMethod')) >= 0;
  }.property('activeMfaMethod'),
  isMfaPasskeyEnrollment: Ember.computed.equal('activeMfaMethod', 'webauthnEnrollment'),
  isMfaRecoveryCode: Ember.computed.equal('activeMfaMethod', 'recoveryCode'),
  isMfaEmailRecovery: Ember.computed.equal('activeMfaMethod', 'emailRecovery'),

  totpEnrollmentQrSvg: function() {
    let uri = this.get('mfaChallenge.totpProvisioningUri');
    if ( !uri ) {
      return null;
    }
    return totpProvisioningQr(uri, this.get('intl').t('loginPage.mfa.totp.qrAlt'));
  }.property('mfaChallenge.totpProvisioningUri', 'intl._locale'),

  oidcProviderName: function() {
    return this.get('access.token.providerDisplayName') || this.get('intl').t('authPage.oidc.defaultProviderName');
  }.property('access.token.providerDisplayName', 'intl._locale'),

  actions: {
    started() {
      this.setProperties({
        'timedOut': false,
        'waiting': true,
        'errorMsg': null,
      });
    },

    authenticate(code) {
      this.send('started');

      Ember.run.later(() => {
        let provider = this.get('useLocalRecovery') ? 'localAuthConfig' : undefined;
        this.get('access').login(code, provider).then((xhr) => {
          this.handleLoginResponse(xhr.body, true);
        }).catch((err) => {
          this.set('waiting', false);

          if ( err && err.status === 401 ) {
            this.set('errorMsg', this.get('intl').t('loginPage.error.authFailed'));
          } else {
            this.set('errorMsg', (err ? err.message : "No response received"));
          }
        }).finally(() => {
          this.set('waiting',false);
        });
      }, 10);
    },

    oidcError(err) {
      this.setProperties({
        waiting: false,
        errorMsg: err && err.message ? err.message : this.get('intl').t('loginOidc.error.generic'),
      });
    },

    useRecoveryLogin() {
      this.setProperties({
        useLocalRecovery: true,
        waiting: false,
        errorMsg: null,
      });
      this.bootstrap();
    },

    usePrimaryLogin() {
      this.setProperties({
        useLocalRecovery: false,
        waiting: false,
        errorMsg: null,
      });
    },

    selectMfaMethod(method) {
      this.setProperties({
        selectedMfaMethod: method,
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
        errorMsg: null,
      });
    },

    verifyMfa() {
      let method = this.get('activeMfaMethod');
      if ( ['webauthn', 'webauthnEnrollment'].indexOf(method) >= 0 ) {
        this.send('verifyPasskey');
        return;
      }
      this.setProperties({waiting: true, errorMsg: null});
      this.get('access').completeMfa({
        code: this.get('mfaChallenge.mfaChallengeId'),
        mfaMethod: method,
        mfaCode: this.get('mfaCode'),
        recoveryCode: this.get('recoveryCode'),
        emailCode: this.get('emailCode'),
      }).then((xhr) => {
        this.handleLoginResponse(xhr.body);
      }).catch((err) => {
        this.setProperties({
          errorMsg: localizedMfaError(err, this.get('intl')),
          waiting: false,
          mfaCode: '',
          recoveryCode: '',
          emailCode: '',
        });
      });
    },

    verifyPasskey() {
      this.setProperties({waiting: true, errorMsg: null});
      let method = this.get('activeMfaMethod');
      let ceremony = method === 'webauthnEnrollment' ? registerPasskey : authenticateWithPasskey;
      ceremony(this.get('mfaChallenge.webAuthnOptions')).then((response) => {
        return this.get('access').completeMfa({
          code: this.get('mfaChallenge.mfaChallengeId'),
          mfaMethod: method,
          webAuthnResponse: response,
        });
      }).then((xhr) => {
        this.handleLoginResponse(xhr.body);
      }).catch((err) => {
        this.setProperties({
          errorMsg: localizedMfaError(err, this.get('intl')),
          waiting: false,
        });
      });
    },

    cancelMfa() {
      this.get('access').cancelMfa();
      this.setProperties({
        selectedMfaMethod: null,
        showMfaRecoveryOptions: false,
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
        errorMsg: null,
        waiting: false,
      });
    },

    showMfaRecoveryOptions() {
      let methods = this.get('recoveryMfaMethods') || [];
      this.setProperties({
        showMfaRecoveryOptions: true,
        selectedMfaMethod: methods[0],
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
        errorMsg: null,
      });
    },

    showMfaPrimaryOptions() {
      let methods = this.get('primaryMfaMethods') || [];
      this.setProperties({
        showMfaRecoveryOptions: false,
        selectedMfaMethod: methods[0],
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
        errorMsg: null,
      });
    },

    acknowledgeRecoveryCodes() {
      this.set('newRecoveryCodes', null);
      this.send('finishLogin');
    },
  },

  handleLoginResponse(body, resetMfaSelection) {
    this.set('waiting', false);
    if ( body && body.mfaRequired ) {
      let methods = this._availableMfaMethods(body.mfaMethods || []);
      let primary = methods.filter((method) => {
        return ['recoveryCode', 'emailRecovery'].indexOf(method) < 0;
      });
      let recovery = methods.filter((method) => {
        return ['recoveryCode', 'emailRecovery'].indexOf(method) >= 0;
      });
      if ( resetMfaSelection || methods.indexOf(this.get('selectedMfaMethod')) < 0 ) {
        this.setProperties({
          selectedMfaMethod: primary[0] || recovery[0] || null,
          showMfaRecoveryOptions: primary.length === 0 && recovery.length > 0,
        });
      }
      this.setProperties({
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
      });
      return;
    }
    if ( body && body.recoveryCodes && body.recoveryCodes.length ) {
      this.set('newRecoveryCodes', body.recoveryCodes);
      return;
    }
    this.send('finishLogin');
  },

  _availableMfaMethods(methods) {
    let webAuthnSupported = this.get('webAuthnEnvironmentSupported');
    return (methods || []).filter((method) => {
      return webAuthnSupported ||
        ['webauthn', 'webauthnEnrollment'].indexOf(method) < 0;
    });
  },

  bootstrap: function() {
    Ember.run.schedule('afterRender', this, () => {
      var user = Ember.$('.login-user')[0];
      var pass = Ember.$('.login-pass')[0];
      if ( user )
      {
        if ( user.value )
        {
          pass.focus();
        }
        else
        {
          user.focus();
        }
      }
    });
  }.on('init'),

  infoMsg: function() {
    if ( this.get('errorMsg') ) {
      return this.get('errorMsg');
    } else if ( this.get('timedOut') ) {
      return this.get('intl').t('loginPage.error.timedOut');
    } else {
      return '';
    }
  }.property('timedOut','errorMsg','intl._locale'),

});
