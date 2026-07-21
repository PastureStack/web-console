import Ember from 'ember';

export default Ember.Controller.extend({
  access: Ember.inject.service(),
  intl: Ember.inject.service(),

  lastRoute: 'admin-tab.auth.github',
  drivers: function() {

    return [
      {route: 'admin-tab.auth.activedirectory', label: this.get('intl').t('authPage.root.providers.activeDirectory'), css: 'activedirectory', available: this.hasRecord('ldapconfig')  },
      {route: 'admin-tab.auth.azuread',         label: this.get('intl').t('authPage.root.providers.azureAd'),         css: 'azuread',         available: this.hasRecord('azureadconfig')  },
      {route: 'admin-tab.auth.github',          label: this.get('intl').t('authPage.root.providers.github'),          css: 'github',          available: this.hasRecord('githubconfig')  },
      {route: 'admin-tab.auth.localauth',       label: this.get('intl').t('authPage.root.providers.local'),           css: 'local',           available: this.hasRecord('localauthconfig')  },
      {route: 'admin-tab.auth.openldap',        label: this.get('intl').t('authPage.root.providers.openldap'),        css: 'openldap',        available: this.hasRecord('openldapconfig')  },
      {route: 'admin-tab.auth.shibboleth',      label: this.get('intl').t('authPage.root.providers.shibboleth'),      css: 'shibboleth',      available: this.hasRecord('shibbolethconfig')  },
    ];
  }.property('intl._locale'),

  hasRecord: function(record) {
    let type = 'schema';
    let authStore = this.get('authStore');
    let userStore = this.get('userStore');

    if (userStore.hasRecordFor(type, record) || authStore.hasRecordFor(type, record)) {
      return true;
    }

    return false;
  },
});
