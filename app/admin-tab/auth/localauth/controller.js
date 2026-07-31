import { later } from '@ember/runloop';
import { Promise } from 'rsvp';
import { computed, get } from '@ember/object';
import { service } from '@ember/service';
import Controller from '@ember/controller';
import C from 'ui/utils/constants';

export default Controller.extend({
  access            : service(),
  settings          : service(),
  intl              : service(),

  confirmDisable    : false,
  errors            : null,
  testing           : false,
  switching         : false,
  error             : null,

  adminName         : '',
  adminPublicValue  : '',
  adminSecretValue  : '',
  adminSecretValue2 : '',

  isLocalActive: computed('access.enabled', 'access.provider', function() {
    return this.get('access.enabled') &&
      (this.get('access.provider') || '').toLowerCase() === 'localauthconfig';
  }),

  isExternalActive: computed('access.enabled', 'isLocalActive', function() {
    return this.get('access.enabled') && !this.get('isLocalActive');
  }),

  createDisabled: computed(
    'adminPublicValue',
    'adminSecretValue',
    'adminSecretValue2',
    'isExternalActive',
    'testing',
    'switching',
    function() {
      var ok = this.get('adminPublicValue.length') && this.get('adminSecretValue.length') && (this.get('adminSecretValue') === this.get('adminSecretValue2'));
      if ( this.get('isExternalActive') ) {
        ok = this.get('adminPublicValue.length') && this.get('adminSecretValue.length');
      }
      return !ok || this.get('testing') || this.get('switching');
    }
  ),

  validateDescription: computed(function() {
    return this.get('settings').get(C.SETTING.AUTH_LOCAL_VALIDATE_DESC) || null;
  }),

  actions: {
    test: function() {
      if ( !this.get('adminPublicValue') )
      {
        return void this.send('showError','Login username is required');
      }

      if ( !this.get('adminSecretValue') )
      {
        return void this.send('showError','Password is required');
      }

      if ( this.get('adminSecretValue') !== this.get('adminSecretValue2') )
      {
        return void this.send('showError','Passwords do not match');
      }

      this.send('clearError');
      this.set('testing', true);

      var model = this.get('model');
      model.setProperties({
        name: this.get('adminName'),
        accessMode: 'unrestricted',
        username: this.get('adminPublicValue'),
        password: this.get('adminSecretValue'),
        enabled: false,
      });

      model.save().then(() => {
        // Wait a bit for the new config to take effect...
        setTimeout(() => {
          this.send('authenticate');
        }, 1000);
      }).catch(err => {
        this.send('gotError', err);
      });
    },

    authenticate: function() {
      this.send('clearError');
      var code = this.get('adminPublicValue')+':'+this.get('adminSecretValue');
      this.get('access').login(code).then(res => {
        this.send('authenticationSucceeded', res.body);
      }).catch(err => {
        this.send('gotError', err);
      });
    },

    authenticationSucceeded: function(/*auth*/) {
      this.send('clearError');

      // Set this to true so the token will be sent with the request
      this.set('access.enabled', true);

      var model = this.get('model');
      model.setProperties({
        enabled: true,
      });

      model.save().then(() => {
        this.send('waitAndRefresh');
      }).catch((err) => {
        this.set('access.enabled', false);
        this.send('gotError', err);
      });
    },

    switchToLocal: function() {
      if ( !this.get('adminPublicValue') || !this.get('adminSecretValue') ) {
        this.send('showError', this.get('intl').t('authPage.localAuth.switch.validation'));
        return;
      }

      this.send('clearError');
      this.set('switching', true);
      let username = this.get('adminPublicValue');
      let password = this.get('adminSecretValue');

      this.get('userStore').createRecord({
        type: 'authIdentityOperation',
        operation: 'switchToLocal',
        localUsername: username,
        localPassword: password,
      }).save().then((result) => {
        let providerSwitchCode = get(result, 'providerSwitchCode');
        if ( !providerSwitchCode ) {
          throw new Error(this.get('intl').t('authPage.localAuth.switch.missingTicket'));
        }

        this.get('access').suspendSession();
        return new Promise((resolve) => {
          later(this, resolve, 1200);
        }).then(() => {
          return this.get('access').login(providerSwitchCode, 'providerSwitch');
        }).catch(() => {
          // If the settings refresh took longer than the one-use ticket
          // request, the already verified local credential is the safe
          // fallback. Access control remains enabled throughout.
          return this.get('access').login(`${username}:${password}`, 'localAuthConfig');
        });
      }).then(() => {
        this.setProperties({
          adminSecretValue: '',
          adminSecretValue2: '',
        });
        this.get('access').setProperties({
          enabled: true,
          provider: 'localauthconfig',
        });
        this.send('waitAndRefresh');
      }).catch((err) => {
        this.send('gotError', err);
      }).finally(() => {
        this.set('switching', false);
      });
    },

    waitAndRefresh: function(url) {
      $('#loading-underlay, #loading-overlay').removeClass('hide').show();
      setTimeout(function() {
        window.location.href = url || window.location.href;
      }, 1000);
    },

    promptDisable: function() {
      this.set('confirmDisable', true);
      later(this, function() {
        this.set('confirmDisable', false);
      }, 10000);
    },

    gotError: function(err) {
      if ( err.message )
      {
        this.send('showError', err.message + (err.detail? '('+err.detail+')' : ''));
      }
      else
      {
        this.send('showError', 'Error ('+err.status + ' - ' + err.code+')');
      }

      this.set('testing', false);
      this.set('switching', false);
      this.set('saving', false);
    },

    showError: function(msg) {
      this.set('errors', [msg]);
      window.scrollY = 0;
    },

    clearError: function() {
      this.set('errors', null);
    },

    disable: function() {
      this.send('clearError');

      var model = this.get('model');
      model.setProperties({
        enabled: false,
        username: "",
        password: "",
      });

      model.save().then(() => {
        this.get('access').clearSessionKeys();
        this.set('access.enabled',false);
        this.send('waitAndRefresh');
      }).catch((err) => {
        this.send('gotError', err);
      }).finally(() => {
        this.set('confirmDisable', false);
      });
    },
  },
  headerText: computed('isLocalActive', 'isExternalActive', 'intl._locale', function() {
    let out = this.get('intl').findTranslationByKey('authPage.localAuth.header.disabled');
    if (this.get('isLocalActive')) {
      out = this.get('intl').findTranslationByKey('authPage.localAuth.header.enabled');
    } else if (this.get('isExternalActive')) {
      out = this.get('intl').findTranslationByKey('authPage.localAuth.header.recovery');
    }
    return this.get('intl').formatHtmlMessage(out);
  }),
});
