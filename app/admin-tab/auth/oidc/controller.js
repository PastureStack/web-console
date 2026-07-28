import Ember from 'ember';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';

export default Ember.Controller.extend({
  access: Ember.inject.service(),
  intl: Ember.inject.service(),
  oidc: Ember.inject.service(),
  settings: Ember.inject.service(),

  config: Ember.computed.alias('model.oidcConfig'),
  advancedOpen: false,
  confirmDisable: false,
  errors: null,
  activating: false,
  preparedFingerprint: null,
  preparedModel: null,
  saving: false,
  saved: false,
  recoveryEnabled: false,
  recoveryLocalModel: null,
  recoveryModel: null,
  recoveryProvider: null,
  testedFingerprint: null,
  testedIdentity: null,
  testing: false,
  preparedToken: null,

  providerDisplayName: function() {
    let name = (this.get('config.displayName') || '').trim();
    return name || this.get('intl').t('authPage.oidc.defaultProviderName');
  }.property('config.displayName', 'intl._locale'),

  oidcEnabled: function() {
    return this.get('access.enabled') && this.get('access.provider') === 'oidcconfig';
  }.property('access.enabled', 'access.provider'),

  callbackUrl: function() {
    let base = this.get('settings').get(C.SETTING.API_HOST) || window.location.origin;
    return `${base.replace(/\/+$/, '')}/login/oidc-auth`;
  }.property(`settings.${C.SETTING.API_HOST}`),

  numUsers: function() {
    return (this.get('model.allowedIdentities') || []).filterBy('externalIdType', C.PROJECT.TYPE_OIDC_USER).get('length');
  }.property('model.allowedIdentities.@each.externalIdType'),

  numGroups: function() {
    return (this.get('model.allowedIdentities') || []).filterBy('externalIdType', C.PROJECT.TYPE_OIDC_GROUP).get('length');
  }.property('model.allowedIdentities.@each.externalIdType'),

  currentFingerprint: function() {
    let config = this.get('config');

    return JSON.stringify([
      config.get('displayName') || '',
      config.get('wellKnownUrl') || '',
      config.get('clientId') || '',
      config.get('clientSecret') || '',
      !!config.get('clientSecretSet'),
      config.get('scopes') || '',
      !!config.get('usePkce'),
      config.get('usernameClaim') || '',
      config.get('displayNameClaim') || '',
      config.get('emailClaim') || '',
      config.get('groupsClaim') || '',
      config.get('certificateAuthority') || '',
    ]);
  }.property(
    'config.displayName',
    'config.wellKnownUrl',
    'config.clientId',
    'config.clientSecret',
    'config.clientSecretSet',
    'config.scopes',
    'config.usePkce',
    'config.usernameClaim',
    'config.displayNameClaim',
    'config.emailClaim',
    'config.groupsClaim',
    'config.certificateAuthority'
  ),

  testDisabled: function() {
    return !this.get('saved') ||
      this.get('preparedFingerprint') !== this.get('currentFingerprint') ||
      this.get('saving') ||
      this.get('testing') ||
      this.get('activating');
  }.property('saved', 'preparedFingerprint', 'currentFingerprint', 'saving', 'testing', 'activating'),

  activateDisabled: function() {
    return !this.get('testedIdentity') ||
      this.get('testedFingerprint') !== this.get('currentFingerprint') ||
      this.get('saving') ||
      this.get('testing') ||
      this.get('activating');
  }.property('testedIdentity', 'testedFingerprint', 'currentFingerprint', 'saving', 'testing', 'activating'),

  testedIdentityName: function() {
    let identity = this.get('testedIdentity') || {};
    return identity.name || identity.login || identity.externalId || '';
  }.property('testedIdentity.name', 'testedIdentity.login', 'testedIdentity.externalId'),

  validate: function() {
    let config = this.get('config');
    let errors = [];
    let displayName = (config.get('displayName') || '').trim();
    let wellKnownUrl = (config.get('wellKnownUrl') || '').trim();
    let clientId = (config.get('clientId') || '').trim();
    let clientSecret = (config.get('clientSecret') || '').trim();
    let scopes = (config.get('scopes') || '').trim().split(/\s+/).filter(Boolean);

    if ( !displayName ) {
      errors.push(this.get('intl').t('authPage.oidc.validation.displayName'));
    }

    if ( !wellKnownUrl ) {
      errors.push(this.get('intl').t('authPage.oidc.validation.wellKnownUrl'));
    } else {
      try {
        let parsed = new URL(wellKnownUrl);
        let localDevelopment = ['localhost', '127.0.0.1', '[::1]'].indexOf(parsed.hostname) >= 0;
        if ( parsed.protocol !== 'https:' && !localDevelopment ) {
          errors.push(this.get('intl').t('authPage.oidc.validation.https'));
        }
      } catch (e) {
        errors.push(this.get('intl').t('authPage.oidc.validation.invalidUrl'));
      }
    }

    if ( !clientId ) {
      errors.push(this.get('intl').t('authPage.oidc.validation.clientId'));
    }

    if ( !clientSecret && !config.get('clientSecretSet') ) {
      errors.push(this.get('intl').t('authPage.oidc.validation.clientSecret'));
    }

    if ( scopes.indexOf('openid') < 0 ) {
      errors.push(this.get('intl').t('authPage.oidc.validation.openidScope'));
    }

    this.set('errors', errors.length ? errors.uniq() : null);
    return errors.length === 0;
  },

  normalizeConfig: function() {
    let config = this.get('config');
    let scopes = (config.get('scopes') || '').trim().split(/\s+/).filter(Boolean).uniq();

    config.setProperties({
      displayName: (config.get('displayName') || '').trim(),
      wellKnownUrl: (config.get('wellKnownUrl') || '').trim(),
      clientId: (config.get('clientId') || '').trim(),
      clientSecret: (config.get('clientSecret') || '').trim(),
      scopes: scopes.join(' '),
      usernameClaim: (config.get('usernameClaim') || '').trim(),
      displayNameClaim: (config.get('displayNameClaim') || '').trim(),
      emailClaim: (config.get('emailClaim') || '').trim(),
      groupsClaim: (config.get('groupsClaim') || '').trim(),
      certificateAuthority: (config.get('certificateAuthority') || '').trim(),
    });
  },

  buildCandidateConfig: function() {
    let candidate = this.get('model').clone();
    candidate.setProperties({
      provider: 'oidcconfig',
      enabled: false,
      accessMode: 'unrestricted',
      allowedIdentities: [],
    });
    return candidate;
  },

  restorePreviousProvider: function(fallbackModel) {
    let provider = (this.get('recoveryProvider') || '').toLowerCase();

    if ( !this.get('recoveryEnabled') ) {
      let disabledCandidate = this.buildCandidateConfig();
      disabledCandidate.set('enabled', false);
      return disabledCandidate.save();
    }

    if ( provider === 'localauthconfig' ) {
      let localRecoveryModel = this.get('recoveryLocalModel');
      if ( !localRecoveryModel ) {
        return Ember.RSVP.reject(new Error('The local authentication recovery configuration is unavailable'));
      }

      let local = localRecoveryModel.clone();
      local.setProperties({
        enabled: true,
        username: '',
        password: '',
      });
      return local.save();
    }

    return fallbackModel.save();
  },

  actions: {
    toggleAdvanced: function() {
      this.toggleProperty('advancedOpen');
    },

    save: function() {
      this.setProperties({
        errors: null,
        preparedFingerprint: null,
        preparedModel: null,
        preparedToken: null,
        saved: false,
        testedFingerprint: null,
        testedIdentity: null,
      });
      this.normalizeConfig();

      if ( !this.validate() ) {
        return;
      }

      this.set('saving', true);
      let candidate = this.buildCandidateConfig();

      this.get('oidc').prepare(candidate).then((token) => {
        this.setProperties({
          preparedFingerprint: this.get('currentFingerprint'),
          preparedModel: candidate,
          preparedToken: token,
          saved: true,
          saving: false,
        });
      }).catch((err) => {
        this.setProperties({
          saved: false,
          saving: false,
        });
        this.send('gotError', err, 'configuration');
      });
    },

    authenticate: function() {
      this.set('errors', null);
      this.set('testing', true);

      this.get('oidc').authorizeTest(this.get('preparedToken'), (err, code) => {
        if ( err ) {
          this.send('gotError', err, 'test');
          return;
        }

        this.get('oidc').test(this.get('preparedModel'), code).then((auth) => {
          this.send('authenticationTestSucceeded', auth);
        }).catch((loginError) => {
          this.send('gotError', loginError, 'test');
        });
      });
    },

    authenticationTestSucceeded: function(auth) {
      let providerIdentities = auth.identities || [];
      let userIdentity = providerIdentities.find((identity) => identity.externalIdType === C.PROJECT.TYPE_OIDC_USER);

      if ( !userIdentity ) {
        this.send('gotError', new Error(this.get('intl').t('authPage.oidc.validation.userIdentity')), 'test');
        return;
      }

      this.setProperties({
        errors: null,
        testedFingerprint: this.get('currentFingerprint'),
        testedIdentity: userIdentity,
        testing: false,
      });
    },

    activate: function() {
      this.setProperties({
        activating: true,
        errors: null,
      });

      // Request a fresh authorization code. The code used for the test was
      // already consumed by the identity provider and must never be reused.
      this.get('oidc').authorizeTest(this.get('preparedToken'), (err, code) => {
        if ( err ) {
          this.send('gotError', err, 'activation');
          return;
        }
        this.send('activateWithCode', code);
      });
    },

    activateWithCode: function(code) {
      let model = this.buildCandidateConfig();
      let rollbackModel = this.get('recoveryModel').clone();
      let configurationSaved = false;

      model.setProperties({
        enabled: true,
        accessMode: 'restricted',
        allowedIdentities: [this.get('testedIdentity')],
      });

      model.save().then(() => {
        configurationSaved = true;
        return this.get('access').login(code, 'oidcconfig');
      }).then(() => {
        this.get('access').setProperties({
          enabled: true,
          provider: 'oidcconfig',
        });
        this.send('waitAndRefresh');
      }).catch((err) => {
        if ( !configurationSaved ) {
          this.send('gotError', err, 'activation');
          return;
        }

        // Keep the current administrator session available if the final
        // platform-session exchange fails after the provider was enabled.
        // Restore the complete prior provider configuration, not merely a
        // disabled OIDC candidate.
        this.restorePreviousProvider(rollbackModel).then(() => {
          this.get('access').setProperties({
            enabled: !!this.get('recoveryEnabled'),
            provider: (this.get('recoveryProvider') || '').toLowerCase(),
          });
          this.send('gotError', new Error(this.get('intl').t('authPage.oidc.test.activationRolledBack', {
            error: Errors.stringify(err),
          })), 'activation');
        }).catch((rollbackError) => {
          this.send('gotError', new Error(this.get('intl').t('authPage.oidc.test.activationRollbackFailed', {
            activationError: Errors.stringify(err),
            rollbackError: Errors.stringify(rollbackError),
          })), 'activation');
        });
      });
    },

    promptDisable: function() {
      this.set('confirmDisable', true);
      Ember.run.later(this, function() {
        this.set('confirmDisable', false);
      }, 10000);
    },

    disable: function() {
      let model = this.get('model').clone();
      model.setProperties({
        enabled: false,
        accessMode: 'unrestricted',
        allowedIdentities: [],
      });

      model.save().then(() => {
        this.get('access').clearSessionKeys();
        this.get('access').set('enabled', false);
        this.send('waitAndRefresh');
      }).catch((err) => {
        this.send('gotError', err);
      }).finally(() => {
        this.set('confirmDisable', false);
      });
    },

    gotError: function(err, stage) {
      this.setProperties({
        errors: [Errors.stringify(err)],
        activating: false,
        saving: false,
        testing: false,
      });

      if ( stage === 'configuration' ) {
        this.setProperties({
          preparedFingerprint: null,
          preparedModel: null,
          preparedToken: null,
          saved: false,
          testedFingerprint: null,
          testedIdentity: null,
        });
      } else if ( stage === 'test' ) {
        this.setProperties({
          testedFingerprint: null,
          testedIdentity: null,
        });
      }
    },

    waitAndRefresh: function(url) {
      $('#loading-underlay, #loading-overlay').removeClass('hide').show();
      setTimeout(function() {
        window.location.href = url || window.location.href;
      }, 1000);
    },
  },
});
