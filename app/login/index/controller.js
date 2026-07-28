import Ember from 'ember';
import { authenticate as authenticateWithPasskey } from 'ui/utils/webauthn';

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

  canLocalRecovery: Ember.computed.alias('access.token.localRecoveryEnabled'),
  mfaChallenge: Ember.computed.alias('access.mfaChallenge'),
  isMfaPending: Ember.computed.bool('mfaChallenge.mfaRequired'),
  emailCodeSent: Ember.computed.alias('mfaChallenge.emailCodeSent'),
  hasNewRecoveryCodes: Ember.computed.notEmpty('newRecoveryCodes'),

  activeMfaMethod: function() {
    let methods = this.get('mfaChallenge.mfaMethods') || [];
    let selected = this.get('selectedMfaMethod');
    return methods.indexOf(selected) >= 0 ? selected : methods[0];
  }.property('mfaChallenge.mfaMethods.[]', 'selectedMfaMethod'),

  isMfaTotp: Ember.computed('activeMfaMethod', function() {
    return ['totp', 'totpEnrollment'].indexOf(this.get('activeMfaMethod')) >= 0;
  }),
  isMfaEnrollment: Ember.computed.equal('activeMfaMethod', 'totpEnrollment'),
  isMfaPasskey: Ember.computed.equal('activeMfaMethod', 'webauthn'),
  isMfaRecoveryCode: Ember.computed.equal('activeMfaMethod', 'recoveryCode'),
  isMfaEmailRecovery: Ember.computed.equal('activeMfaMethod', 'emailRecovery'),

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
          this.handleLoginResponse(xhr.body);
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
      if ( method === 'webauthn' ) {
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
          errorMsg: err && err.message ? err.message :
            this.get('intl').t('loginPage.mfa.error.invalid'),
          waiting: false,
          mfaCode: '',
          recoveryCode: '',
          emailCode: '',
        });
      });
    },

    verifyPasskey() {
      this.setProperties({waiting: true, errorMsg: null});
      authenticateWithPasskey(this.get('mfaChallenge.webAuthnOptions')).then((response) => {
        return this.get('access').completeMfa({
          code: this.get('mfaChallenge.mfaChallengeId'),
          mfaMethod: 'webauthn',
          webAuthnResponse: response,
        });
      }).then((xhr) => {
        this.handleLoginResponse(xhr.body);
      }).catch((err) => {
        let message = err && err.message;
        if ( message === 'WebAuthnUnavailable' ) {
          message = this.get('intl').t('loginPage.mfa.error.secureContext');
        }
        this.setProperties({
          errorMsg: message || this.get('intl').t('loginPage.mfa.error.invalid'),
          waiting: false,
        });
      });
    },

    cancelMfa() {
      this.get('access').cancelMfa();
      this.setProperties({
        selectedMfaMethod: null,
        mfaCode: '',
        recoveryCode: '',
        emailCode: '',
        errorMsg: null,
        waiting: false,
      });
    },

    copyRecoveryCodes() {
      let value = (this.get('newRecoveryCodes') || []).join('\n');
      if ( navigator.clipboard && window.isSecureContext ) {
        navigator.clipboard.writeText(value);
      }
    },

    acknowledgeRecoveryCodes() {
      this.set('newRecoveryCodes', null);
      this.send('finishLogin');
    },
  },

  handleLoginResponse(body) {
    this.set('waiting', false);
    if ( body && body.mfaRequired ) {
      let methods = body.mfaMethods || [];
      if ( methods.indexOf(this.get('selectedMfaMethod')) < 0 ) {
        this.set('selectedMfaMethod', methods[0]);
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
