import { alias, equal } from '@ember/object/computed';
import { A } from '@ember/array';
import Controller from '@ember/controller';
import { service } from '@ember/service';
import { resolve } from 'rsvp';
import NewOrEdit from 'ui/mixins/new-or-edit';
import { credentialsForRegistry, definitelyRejected } from 'ui/utils/registry-save';
import Errors from 'ui/utils/errors';

export default Controller.extend(NewOrEdit, {
  editing: false,
  primaryResource: alias('model.registry'),
  intl: service(),
  store: service(),

  registryCreated: false,
  registrySaveAttempted: false,
  registryOutcomeUnknown: false,
  credentialSaveAttempted: false,
  credentialOutcomeUnknown: false,
  credentialSaved: false,
  savedCredentialId: null,

  activeDriver: null,
  isCustom: equal('activeDriver','custom'),

  actions: {
    selectDriver: function(name) {
      if ( this.get('registrySaveAttempted') ) {
        return;
      }
      var driver = this.get('drivers').filterBy('name',name)[0];
      this.set('activeDriver', driver.name);
      this.set('model.registry.serverAddress', driver.value);
    },

    cancel: function() {
      if ( this.get('saving') || this._saveOwner ) {
        return;
      }

      const cancelKey = this.get('credentialSaved') ? 'registriesPage.new.cancelRefreshConfirm' : 'registriesPage.new.cancelConfirm';
      if ( this.get('registrySaveAttempted') && !window.confirm(this.get('intl').t(cancelKey, {
        address: this.get('model.registry.serverAddress'),
        id: this.get('model.registry.id') || this.get('intl').t('registriesPage.new.unknownId'),
      })) ) {
        return;
      }

      this.get('router').transitionTo('registries');
    },
  },

  drivers: function() {
    var drivers = [
      {name: 'dockerhub', label: 'DockerHub',  css: 'dockerhub', value: 'index.docker.io' },
      {name: 'quay',      label: 'Quay.io',    css: 'quay',      value: 'quay.io',        },
      {name: 'custom',    label: 'Custom',     css: 'custom',    value: '',               },
    ];

    var active = this.get('activeDriver');
    drivers.forEach(function(driver) {
      driver.active = ( active === driver.name );
    });

    return drivers;
  }.property('activeDriver'),

  cleanAddress: function() {
    let cur = this.get('model.registry.serverAddress')||'';
    let neu = cur.replace(/^http(s)?:\/\/(.*)$/,'$2');
    neu = neu.replace(/\/.*$/,'');

    if ( cur !== neu ) {
      this.set('model.registry.serverAddress', neu);
    }

  },

  validate: function() {
    if ( this.get('credentialSaved') ) {
      this.set('errors', null);
      return true;
    }

    if ( !this.get('registrySaveAttempted') ) {
      this.cleanAddress();
      this._super();
    } else {
      this.set('errors', null);
    }

    var errors = A(this.get('errors') || []);

    var registry = this.get('model.registry');
    var existing = this.get('model.allRegistries').filterBy('serverAddress', registry.get('serverAddress')).find((item) => {
      return item !== registry && (!registry.get('id') || item.get('id') !== registry.get('id'));
    });
    if ( existing && !this.get('registryCreated') )
    {
      errors.push(this.get('intl').t('registriesPage.new.duplicateAddress', {address: existing.get('displayAddress')}));
    }

    var cred = this.get('model.credential');
    cred.set('registryId', registry.get('id') || 'tbd');

    errors.pushObjects(cred.validationErrors());

    if ( errors.get('length') > 0 )
    {
      this.set('errors', errors.uniq());
      return false;
    }

    return true;
  },

  doSave: function() {
    if ( this.get('registryCreated') ) {
      return this.get('model.registry');
    }

    if ( this.get('registryOutcomeUnknown') ) {
      throw new Error(this.get('intl').t('registriesPage.new.registryOutcomeUnknown'));
    }

    this.set('registrySaveAttempted', true);
    return this.get('model.registry').save().then((registry) => {
      this.mergeResult(registry);
      if ( !registry.get('id') ) {
        throw new Error(this.get('intl').t('registriesPage.new.registryOutcomeUnknown'));
      }
      this.set('registryCreated', true);
      return registry;
    });
  },

  didSave: function() {
    var registry = this.get('model.registry');
    var cred = this.get('model.credential');

    if ( this.get('credentialSaved') ) {
      return cred;
    }

    if ( this.get('credentialSaveAttempted') ) {
      // findAll returns the live cache (including stale entries); inspect the
      // fresh collection response itself before deciding whether another POST is safe.
      return this.get('store').find('registrycredential', null, {forceReload: true}).then((credentials) => {
        const existing = credentialsForRegistry(credentials, registry.get('id'));
        if ( existing.get('length') ) {
          throw new Error(this.get('intl').t('registriesPage.new.credentialPresent'));
        }
        if ( this.get('credentialOutcomeUnknown') ) {
          throw new Error(this.get('intl').t('registriesPage.new.credentialOutcomeUnknown'));
        }
        return this.saveCredential();
      });
    }

    const existing = registry.get('credentials.lastObject');
    if ( existing ) {
      existing.merge(cred);
      return this.trackCredentialSave(() => existing.save());
    }

    return this.saveCredential();
  },

  saveCredential: function() {
    const cred = this.get('model.credential');
    cred.set('registryId', this.get('model.registry.id'));
    return this.trackCredentialSave(() => cred.save());
  },

  trackCredentialSave: function(save) {
    this.set('credentialSaveAttempted', true);
    return resolve().then(save).then(
      (saved) => this.markCredentialSaved(saved),
      (error) => {
        this.set('credentialOutcomeUnknown', !definitelyRejected(error));
        throw error;
      }
    );
  },

  markCredentialSaved: function(credential) {
    if ( !credential.get('id') ) {
      this.set('credentialOutcomeUnknown', true);
      throw new Error(this.get('intl').t('registriesPage.new.credentialOutcomeUnknown'));
    }
    this.setProperties({
      credentialSaved: true,
      savedCredentialId: credential.get('id'),
    });
    return credential;
  },

  errorSaving: function(error) {
    if ( !this.get('registryCreated') ) {
      if ( definitelyRejected(error) ) {
        this.set('registrySaveAttempted', false);
      } else if ( this.get('registrySaveAttempted') ) {
        this.set('registryOutcomeUnknown', true);
        this.set('errors', [this.get('intl').t('registriesPage.new.registryOutcomeUnknown')]);
      }
    } else if ( this.get('credentialSaved') ) {
      this.set('errors', [this.get('intl').t('registriesPage.new.refreshFailed')]);
    } else {
      const errors = [this.get('intl').t('registriesPage.new.partialFailure', {
        address: this.get('model.registry.serverAddress'),
        id: this.get('model.registry.id'),
      })];
      const detail = Errors.stringify(error);
      if ( detail ) {
        errors.push(detail);
      }
      this.set('errors', errors);
    }
  },

  doneSaving: function() {
    const store = this.get('store');
    const registryId = this.get('model.registry.id');
    const credentialId = this.get('savedCredentialId');

    return store.find('registrycredential', credentialId, {forceReload: true}).then(() => {
      return store.find('registry', registryId, {forceReload: true});
    }).then(() => this.get('router').transitionTo('registries'));
  },
});
