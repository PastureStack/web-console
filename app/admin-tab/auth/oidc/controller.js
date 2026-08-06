import Ember from 'ember';
import C from 'ui/utils/constants';
import Errors from 'ui/utils/errors';
import { denormalizeName } from 'ui/services/settings';

const LOCAL_RECOVERY_ERRORS = {
  LocalCredentialsRequired: 'authPage.oidc.localRecovery.errors.credentialsRequired',
  InvalidLocalAdministrator: 'authPage.oidc.localRecovery.errors.invalidAdministrator',
  LocalAdministratorMfaRequired: 'authPage.oidc.localRecovery.errors.mfaRequired',
};

function apiErrorCode(err) {
  if ( !err ) {
    return null;
  }
  let body = err.body;
  if ( typeof body === 'string' ) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return err.code || err.type ||
    (body && (body.code || body.type)) ||
    (err.xhr && err.xhr.responseJSON &&
      (err.xhr.responseJSON.code || err.xhr.responseJSON.type));
}

export default Ember.Controller.extend({
  access: Ember.inject.service(),
  intl: Ember.inject.service(),
  oidc: Ember.inject.service(),
  session: Ember.inject.service(),
  settings: Ember.inject.service(),
  userStore: Ember.inject.service('user-store'),

  config: Ember.computed.alias('model.oidcConfig'),
  advancedOpen: false,
  errors: null,
  activating: false,
  applyingIdentity: false,
  identityUpdateSuccess: false,
  identityConfirmationFingerprint: null,
  preparedFingerprint: null,
  preparedModel: null,
  saving: false,
  saved: false,
  recoveryEnabled: false,
  recoveryLocalModel: null,
  recoveryModel: null,
  recoveryProvider: null,
  localRecoveryUsername: '',
  localRecoveryPassword: '',
  restoringIdentityAccount: false,
  identityMatchAccountId: null,
  identityStrategy: 'bind',
  oldAccountDisposition: 'keep',
  selectedTargetAccountId: null,
  testedIdentityProof: null,
  testedFingerprint: null,
  testedIdentity: null,
  testing: false,
  preparedToken: null,
  transferPermissions: true,

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

  platformOrigin: function() {
    return window.location.origin;
  },

  platformHostname: function() {
    return window.location.hostname;
  },

  ensureApiHost: function() {
    let configured = this.get('settings').get(C.SETTING.API_HOST);
    let origin = this.platformOrigin();

    if ( configured || this.platformHostname() === 'localhost' ) {
      return Ember.RSVP.resolve(configured || origin);
    }

    return this.get('userStore').find('setting', denormalizeName(C.SETTING.API_HOST)).then((setting) => {
      let current = setting.get('value');
      if ( current ) {
        return current;
      }

      setting.set('value', origin);
      return setting.save().then(() => origin);
    });
  },

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
      !this.get('mappingReady') ||
      !this.get('localRecoveryCredentialsReady') ||
      this.get('testedFingerprint') !== this.get('currentFingerprint') ||
      this.get('saving') ||
      this.get('testing') ||
      this.get('activating');
  }.property(
    'testedIdentity',
    'mappingReady',
    'localRecoveryCredentialsReady',
    'testedFingerprint',
    'currentFingerprint',
    'saving',
    'testing',
    'activating'
  ),

  localRecoveryCredentialsReady: function() {
    return !!(this.get('localRecoveryUsername') || '').trim() &&
      !!(this.get('localRecoveryPassword') || '').trim();
  }.property('localRecoveryUsername', 'localRecoveryPassword'),

  testedIdentityName: function() {
    let identity = this.get('testedIdentity') || {};
    return identity.name || identity.login || identity.externalId || '';
  }.property('testedIdentity.name', 'testedIdentity.login', 'testedIdentity.externalId'),

  activeAdminAccounts: function() {
    return (this.get('accounts') || []).filter((account) => {
      return account.get('kind') === 'admin' &&
        ['active', 'activating', 'updating-active'].indexOf(account.get('state')) >= 0;
    });
  }.property('accounts.@each.{kind,state}'),

  adminAccountChoices: function() {
    return (this.get('activeAdminAccounts') || []).map((account) => {
      return {
        label: `${account.get('name') || account.get('id')} (${account.get('id')})`,
        value: account.get('id'),
      };
    });
  }.property('activeAdminAccounts.@each.{id,name}'),

  activeHumanAccounts: function() {
    return (this.get('accounts') || []).filter((account) => {
      return ['service', 'agent', 'project'].indexOf(account.get('kind')) < 0 &&
        ['active', 'activating', 'updating-active'].indexOf(account.get('state')) >= 0;
    });
  }.property('accounts.@each.{kind,state}'),

  identityTargetChoices: function() {
    let accounts = this.get('oidcEnabled') ?
      this.get('activeHumanAccounts') : this.get('activeAdminAccounts');
    return (accounts || []).map((account) => {
      return {
        label: `${account.get('name') || account.get('id')} (${account.get('id')})`,
        value: account.get('id'),
      };
    });
  }.property('oidcEnabled', 'activeHumanAccounts.@each.{id,name}', 'activeAdminAccounts.@each.{id,name}'),

  oldAccountDispositionChoices: [
    {label: 'authPage.oidc.identity.disposition.keep', value: 'keep'},
    {label: 'authPage.oidc.identity.disposition.disable', value: 'disable'},
    {label: 'authPage.oidc.identity.disposition.discard', value: 'discardPermissions'},
  ],

  currentAccountId: Ember.computed.alias('session.accountId'),

  matchedAccount: function() {
    return (this.get('accounts') || []).findBy('id', this.get('identityMatchAccountId'));
  }.property('identityMatchAccountId', 'accounts.@each.id'),

  selectedTargetAccount: function() {
    return (this.get('accounts') || []).findBy('id', this.get('selectedTargetAccountId'));
  }.property('selectedTargetAccountId', 'accounts.@each.id'),

  hasIdentityConflict: function() {
    let matched = this.get('identityMatchAccountId');
    return !!matched && matched !== this.get('selectedTargetAccountId');
  }.property('identityMatchAccountId', 'selectedTargetAccountId'),

  matchedAccountIsActive: function() {
    let account = this.get('matchedAccount');
    return !!account &&
      ['active', 'activating', 'updating-active'].indexOf(account.get('state')) >= 0;
  }.property('matchedAccount.state'),

  canRestoreMatchedAccount: function() {
    return !!this.get('matchedAccount') && !this.get('matchedAccountIsActive');
  }.property('matchedAccount', 'matchedAccountIsActive'),

  targetAccountReady: function() {
    if ( !this.get('testedIdentityProof') || !this.get('selectedTargetAccountId') ) {
      return false;
    }
    let target = this.get('selectedTargetAccount');
    let targetIsActive = target &&
      ['active', 'activating', 'updating-active'].indexOf(target.get('state')) >= 0;
    if ( !targetIsActive || (!this.get('oidcEnabled') && target.get('kind') !== 'admin') ) {
      return false;
    }
    if ( this.get('identityStrategy') === 'useExisting' ) {
      return !!this.get('identityMatchAccountId') &&
        this.get('identityMatchAccountId') === this.get('selectedTargetAccountId');
    }
    return true;
  }.property('testedIdentityProof', 'selectedTargetAccountId', 'selectedTargetAccount.{kind,state}',
    'identityStrategy', 'identityMatchAccountId', 'oidcEnabled'),

  identityDecisionFingerprint: function() {
    return JSON.stringify([
      this.get('identityMatchAccountId') || '',
      this.get('selectedTargetAccountId') || '',
      this.get('identityStrategy') || '',
      !!this.get('transferPermissions'),
      this.get('oldAccountDisposition') || 'keep',
    ]);
  }.property('identityMatchAccountId', 'selectedTargetAccountId', 'identityStrategy',
    'transferPermissions', 'oldAccountDisposition'),

  identityChangeConfirmed: function() {
    return !this.get('hasIdentityConflict') ||
      this.get('identityConfirmationFingerprint') === this.get('identityDecisionFingerprint');
  }.property('hasIdentityConflict', 'identityConfirmationFingerprint', 'identityDecisionFingerprint'),

  mappingReady: function() {
    return this.get('targetAccountReady') && this.get('identityChangeConfirmed');
  }.property('targetAccountReady', 'identityChangeConfirmed'),

  identityApplyDisabled: function() {
    return !this.get('mappingReady') || this.get('testing') || this.get('applyingIdentity');
  }.property('mappingReady', 'testing', 'applyingIdentity'),

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

  identityOperation: function(fields) {
    return this.get('userStore').createRecord(Object.assign({
      type: 'authIdentityOperation',
    }, fields)).save();
  },

  localizedOidcError: function(err) {
    let key = LOCAL_RECOVERY_ERRORS[apiErrorCode(err)];
    return key ? this.get('intl').t(key) : Errors.stringify(err);
  },

  inspectVerifiedIdentity: function(identityProof) {
    return this.identityOperation({
      operation: 'inspect',
      identityProof: identityProof,
    }).then((result) => {
      let matchedAccountId = Ember.get(result, 'matchedAccountId') || null;
      let currentAccountId = this.get('currentAccountId');
      let matchedAccount = (this.get('accounts') || []).findBy('id', matchedAccountId);
      let useMatched = !!matchedAccountId;

      this.setProperties({
        identityMatchAccountId: matchedAccountId,
        identityConfirmationFingerprint: null,
        identityStrategy: useMatched ? 'useExisting' : 'bind',
        oldAccountDisposition: 'keep',
        selectedTargetAccountId: useMatched ? matchedAccountId : currentAccountId,
        transferPermissions: true,
      });

      let matchedIsActive = matchedAccount &&
        ['active', 'activating', 'updating-active'].indexOf(matchedAccount.get('state')) >= 0;
      let matchedCanBeUsed = matchedIsActive &&
        (this.get('oidcEnabled') || matchedAccount.get('kind') === 'admin');
      if ( matchedAccountId && !matchedCanBeUsed ) {
        this.setProperties({
          identityStrategy: 'reassign',
          selectedTargetAccountId: currentAccountId,
        });
      }
      return result;
    });
  },

  assignVerifiedIdentity: function(prepareProviderSwitch) {
    let sourceAccountId = this.get('identityMatchAccountId');
    let strategy = this.get('identityStrategy');
    let targetAccountId = strategy === 'useExisting' ? sourceAccountId : this.get('selectedTargetAccountId');
    let operation = sourceAccountId && sourceAccountId !== targetAccountId ? 'reassign' : 'bind';
    let fields = {
      operation: operation,
      identityProof: this.get('testedIdentityProof'),
      targetAccountId: targetAccountId,
      prepareProviderSwitch: !!prepareProviderSwitch,
    };

    if ( operation === 'reassign' ) {
      fields.sourceAccountId = sourceAccountId;
      fields.transferPermissions = !!this.get('transferPermissions');
      fields.oldAccountDisposition = this.get('oldAccountDisposition') || 'keep';
    }
    if ( prepareProviderSwitch ) {
      fields.localUsername = (this.get('localRecoveryUsername') || '').trim();
      fields.localPassword = this.get('localRecoveryPassword') || '';
    }

    return this.identityOperation(fields);
  },

  prepareIdentitySwitch: function() {
    return this.assignVerifiedIdentity(true).then((result) => {
      let code = Ember.get(result, 'providerSwitchCode');
      if ( !code ) {
        throw new Error(this.get('intl').t('authPage.oidc.identity.missingSwitchTicket'));
      }
      return code;
    });
  },

  cancelIdentitySwitch: function(providerSwitchCode) {
    if ( !providerSwitchCode ) {
      return Ember.RSVP.resolve();
    }
    return this.identityOperation({
      operation: 'cancelSwitch',
      providerSwitchCode: providerSwitchCode,
    });
  },

  activateWithCodeFlow: function(code) {
    let model = this.buildCandidateConfig();
    let rollbackModel = this.get('recoveryModel').clone();
    let configurationSaved = false;
    let sessionSnapshot = null;
    let providerSwitchCode = null;

    model.setProperties({
      enabled: true,
      accessMode: 'restricted',
      allowedIdentities: [this.get('testedIdentity')],
    });

    // The verified identity is linked first and a short-lived, one-use
    // recovery ticket is issued. Security remains enabled throughout the
    // switch; the ticket is used only if the fresh provider login fails.
    return this.prepareIdentitySwitch().then((switchCode) => {
      providerSwitchCode = switchCode;
      return model.save();
    }).then(() => {
      configurationSaved = true;
      sessionSnapshot = this.get('access').suspendSession();
      return this.get('access').login(code, 'oidcconfig', {
        providerSwitchCode: providerSwitchCode,
      });
    }).then(() => {
      return this.cancelIdentitySwitch(providerSwitchCode).catch(() => undefined);
    }).then(() => {
      sessionSnapshot = null;
      this.get('access').setProperties({
        enabled: true,
        provider: 'oidcconfig',
      });
      this.send('waitAndRefresh');
    }).catch((err) => {
      if ( !configurationSaved ) {
        return this.cancelIdentitySwitch(providerSwitchCode).catch(() => undefined).then(() => {
          this.send('gotError', err, 'activation');
        });
      }

      return this.get('access').login(providerSwitchCode, 'providerSwitch').then(() => {
        return this.restorePreviousProvider(rollbackModel);
      }).then(() => {
        if ( sessionSnapshot ) {
          this.get('access').restoreSession(sessionSnapshot);
        }
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

  restoreMatchedIdentityAccount: function() {
    let matchedAccountId = this.get('identityMatchAccountId');
    if ( !matchedAccountId || !this.get('canRestoreMatchedAccount') ) {
      return Ember.RSVP.resolve();
    }

    this.setProperties({
      errors: null,
      identityConfirmationFingerprint: null,
      restoringIdentityAccount: true,
    });
    return this.identityOperation({
      operation: 'restore',
      targetAccountId: matchedAccountId,
    }).then(() => {
      return this.get('userStore').find('account', null, {
        filter: {'kind_ne': ['service', 'agent', 'project']},
        forceReload: true,
      });
    }).then((accounts) => {
      this.setProperties({
        accounts: accounts,
        identityStrategy: 'useExisting',
        selectedTargetAccountId: matchedAccountId,
        restoringIdentityAccount: false,
      });
    }).catch((err) => {
      this.set('restoringIdentityAccount', false);
      this.send('gotError', err, 'management');
    });
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
        identityMatchAccountId: null,
        identityConfirmationFingerprint: null,
        identityStrategy: 'bind',
        selectedTargetAccountId: null,
        testedIdentityProof: null,
        testedFingerprint: null,
        testedIdentity: null,
      });
      this.normalizeConfig();

      if ( !this.validate() ) {
        return;
      }

      this.set('saving', true);
      let candidate = this.buildCandidateConfig();

      this.ensureApiHost().then(() => this.get('oidc').prepare(candidate)).then((token) => {
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

    manageIdentity: function() {
      this.setProperties({
        errors: null,
        identityUpdateSuccess: false,
        identityMatchAccountId: null,
        identityConfirmationFingerprint: null,
        identityStrategy: 'bind',
        selectedTargetAccountId: this.get('currentAccountId'),
        testedIdentity: null,
        testedIdentityProof: null,
        testing: true,
      });
      this.normalizeConfig();
      if ( !this.validate() ) {
        this.set('testing', false);
        return;
      }

      let candidate = this.buildCandidateConfig();
      this.ensureApiHost().then(() => this.get('oidc').prepare(candidate)).then((token) => {
        this.get('oidc').authorizeTest(token, (err, code) => {
          if ( err ) {
            this.send('gotError', err, 'management');
            return;
          }
          this.get('oidc').test(candidate, code).then((auth) => {
            this.send('authenticationTestSucceeded', auth);
          }).catch((loginError) => {
            this.send('gotError', loginError, 'management');
          });
        });
      }).catch((err) => {
        this.send('gotError', err, 'management');
      });
    },

    authenticationTestSucceeded: function(auth) {
      let providerIdentities = auth.identities || [];
      let userIdentity = providerIdentities.find((identity) => identity.externalIdType === C.PROJECT.TYPE_OIDC_USER);

      if ( !userIdentity ) {
        this.send('gotError', new Error(this.get('intl').t('authPage.oidc.validation.userIdentity')), 'test');
        return;
      }
      if ( !auth.identityProof ) {
        this.send('gotError', new Error(this.get('intl').t('authPage.oidc.identity.missingProof')), 'test');
        return;
      }

      this.setProperties({
        errors: null,
        testedFingerprint: this.get('currentFingerprint'),
        testedIdentity: userIdentity,
        testedIdentityProof: auth.identityProof,
      });
      this.inspectVerifiedIdentity(auth.identityProof).then(() => {
        this.set('testing', false);
      }).catch((err) => {
        this.send('gotError', err, 'test');
      });
    },

    chooseIdentityStrategy: function(strategy) {
      let target = strategy === 'useExisting'
        ? this.get('identityMatchAccountId')
        : (this.get('selectedTargetAccountId') || this.get('currentAccountId'));
      this.setProperties({
        identityConfirmationFingerprint: null,
        identityStrategy: strategy,
        selectedTargetAccountId: target,
      });
    },

    confirmIdentityDecision: function() {
      this.set('identityConfirmationFingerprint', this.get('identityDecisionFingerprint'));
    },

    restoreMatchedAccount: function() {
      return this.restoreMatchedIdentityAccount();
    },

    applyIdentityMapping: function() {
      if ( !this.get('mappingReady') ) {
        return;
      }
      this.setProperties({
        applyingIdentity: true,
        errors: null,
        identityUpdateSuccess: false,
      });
      this.assignVerifiedIdentity(false).then(() => {
        this.setProperties({
          applyingIdentity: false,
          identityUpdateSuccess: true,
          identityMatchAccountId: null,
          identityConfirmationFingerprint: null,
          selectedTargetAccountId: null,
          testedIdentity: null,
          testedIdentityProof: null,
        });
        return this.get('userStore').find('account', null, {
          filter: {'kind_ne': ['service', 'agent', 'project']},
          forceReload: true,
        }).then((accounts) => this.set('accounts', accounts));
      }).catch((err) => {
        this.send('gotError', err, 'management');
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
      return this.activateWithCodeFlow(code);
    },

    gotError: function(err, stage) {
      this.setProperties({
        errors: [this.localizedOidcError(err)],
        activating: false,
        applyingIdentity: false,
        restoringIdentityAccount: false,
        saving: false,
        testing: false,
      });
      if ( stage === 'activation' ) {
        this.set('localRecoveryPassword', '');
      }

      if ( stage === 'configuration' ) {
        this.setProperties({
          preparedFingerprint: null,
          preparedModel: null,
          preparedToken: null,
          saved: false,
          identityMatchAccountId: null,
          identityConfirmationFingerprint: null,
          selectedTargetAccountId: null,
          testedIdentityProof: null,
          testedFingerprint: null,
          testedIdentity: null,
        });
      } else if ( stage === 'test' ) {
        this.setProperties({
          identityMatchAccountId: null,
          identityConfirmationFingerprint: null,
          selectedTargetAccountId: null,
          testedIdentityProof: null,
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
