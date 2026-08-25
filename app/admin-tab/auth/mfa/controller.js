import EmberObject from '@ember/object';
import Controller from '@ember/controller';
import MfaAccountManager from 'ui/mixins/mfa-account-manager';

export default Controller.extend(MfaAccountManager, {
  queryParams: ['accountId'],
  accountId: null,
  settingsForm: null,
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

  enforcementChoices: [
    {label: 'authPage.mfa.settings.optional', value: 'optional'},
    {label: 'authPage.mfa.settings.requiredAdmins', value: 'requiredAdmins'},
    {label: 'authPage.mfa.settings.requiredAll', value: 'requiredAll'},
  ],

  federatedMfaChoices: [
    {label: 'authPage.mfa.settings.federatedPlatform', value: 'platform'},
    {label: 'authPage.mfa.settings.federatedTrustedClaims', value: 'trustedClaims'},
  ],

  passkeyCounterChoices: [
    {label: 'authPage.mfa.settings.passkeyCounterRiskAware', value: 'riskAware'},
    {label: 'authPage.mfa.settings.passkeyCounterStrict', value: 'strict'},
  ],

  securityEmailLocaleChoices: [
    {label: 'authPage.mfa.settings.localeTraditionalChinese', value: 'zh-tw'},
    {label: 'authPage.mfa.settings.localeEnglish', value: 'en-us'},
  ],

  actions: {
    selectAccount(selection) {
      let accountId = selection && selection.value;
      this.setProperties({
        accountId: accountId,
        selectedAccountId: accountId,
      });
    },

    revokeAllFactors() {
      if ( window.confirm(this.get('intl').t('authPage.mfa.factor.confirmRevokeAll')) ) {
        return this.runSensitiveOperation({operation: 'revokeAllFactors'})
          .then(() => this.afterSessionRevocation())
          .catch((err) => this.handleError(err));
      }
    },

    saveSettings(sendTestEmail) {
      let form = this.get('settingsForm');
      let data = form.getProperties(
        'enforcement', 'passkeyLimit', 'relyingPartyId', 'origin', 'relyingPartyName',
        'issuer', 'smtpEnabled', 'smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword',
        'smtpClearPassword', 'smtpFrom', 'smtpStartTls', 'smtpSsl', 'smtpConnectionTimeoutMillis',
        'smtpReadTimeoutMillis', 'emailCodeTtlSeconds', 'maximumFailedAttempts',
        'lockoutSeconds', 'securityConfirmationTtlSeconds', 'federatedMfaMode',
        'trustedAuthenticationMethods', 'trustedAuthenticationContexts',
        'maximumFederatedAuthenticationAgeSeconds', 'passkeyCounterPolicy',
        'securityEmailLocale'
      );
      data.sendTestEmail = !!sendTestEmail;
      data.testRecipient = this.get('testRecipient');
      this.setProperties({busy: true, errors: null});
      return this.withSecurityConfirmation((confirmation) => {
        let payload = Object.assign({}, data);
        if ( confirmation ) {
          payload.securityConfirmation = confirmation;
        }
        return this.get('userStore').rawRequest({
          url: 'mfaSettings/global',
          method: 'PUT',
          data: payload,
        });
      }).then(() => {
        form.set('smtpPassword', '');
        return this.reloadSettings();
      }).catch((err) => this.handleError(err)).finally(() => this.set('busy', false));
    },
  },

  reloadSettings() {
    return this.get('userStore').find('mfaSettings', null, {forceReload: true}).then((items) => {
      let settings = items.get('firstObject');
      this.set('settingsForm', EmberObject.create(settings ? settings.serialize() : {}));
    });
  },
});
