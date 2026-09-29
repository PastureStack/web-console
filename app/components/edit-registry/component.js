import EmberObject from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import { resolve } from 'rsvp';
import NewOrEdit from 'ui/mixins/new-or-edit';
import ModalBase from 'lacsso/components/modal-base';
import { credentialsForRegistry, definitelyRejected } from 'ui/utils/registry-save';

export default ModalBase.extend(NewOrEdit, {
  classNames: ['lacsso', 'modal-container', 'large-modal'],
  originalModel: alias('modalService.modalOpts'),
  error: null,
  credentials: null,
  model: null,
  editing: true,
  primaryResource: null,
  intl: service(),
  projects: service(),
  missingCredential: false,
  credentialSaveAttempted: false,
  credentialOutcomeUnknown: false,

  canSaveCredential: function() {
    let projectId = this.get('originalModel.projectId');
    let currentProjectId = this.get('projects.current.id');
    if ( !currentProjectId || this.get('projects.schemaProjectId') !== currentProjectId ||
      projectId !== currentProjectId ) {
      return false;
    }

    let credential = this.get('originalModel.credential');
    return credential ? Boolean(credential.get('actionLinks.update')) :
      this.get('projects').canCreateResource('registryCredential');
  }.property('originalModel.credential', 'originalModel.credential.actionLinks.update',
    'originalModel.projectId', 'projects.current.id', 'projects.schemaProjectId',
    'projects.schemaLoadGeneration'),

  init: function() {
    this._super(...arguments);
    var orig = this.get('originalModel');
    var registry = orig.get('registry');
    var originalCredential = orig.get('credential');
    var missingCredential = !originalCredential;
    var credential = originalCredential ? originalCredential.clone() : registry.get('store').createRecord({
      type: 'registryCredential',
      registryId: registry.get('id'),
      email: 'not-really@required.anymore',
    });

    this.set('model',EmberObject.create({
      allRegistries: orig.get('registries'),
      registry: registry.clone(),
      credential: credential
    }));

    this.setProperties({
      'primaryResource': this.get('model.credential'),
      'activeDriver': 'custom',
      'editing': true,
      'missingCredential': missingCredential,
    });
  },

  doSave: function() {
    if ( !this.get('canSaveCredential') ) {
      throw {status: 403, code: 'Forbidden', messageKey: 'resourceSaveError.unavailable'};
    }

    if ( !this.get('missingCredential') ) {
      const credential = this.get('primaryResource');
      const data = {
        publicValue: credential.get('publicValue'),
        secretValue: credential.get('secretValue'),
      };

      const registryId = this.get('originalModel.registry.id');
      const saveCredential = this._super.bind(this);
      return this.get('originalModel.registry.store').find('registrycredential', credential.get('id'), {forceReload: true}).then((fresh) => {
        if ( !fresh || fresh.get('registryId') !== registryId ) {
          throw {status: 404, code: 'NotFound', messageKey: 'resourceSaveError.unavailable'};
        }
        if ( !this.get('canSaveCredential') || !fresh.get('actionLinks.update') ) {
          throw {status: 403, code: 'Forbidden', messageKey: 'resourceSaveError.unavailable'};
        }

        return saveCredential({data});
      });
    }

    const registry = this.get('originalModel.registry');
    return registry.get('store').find('registrycredential', null, {forceReload: true}).then((credentials) => {
      if ( !this.get('canSaveCredential') ) {
        throw {status: 403, code: 'Forbidden', messageKey: 'resourceSaveError.unavailable'};
      }

      const existing = credentialsForRegistry(credentials, registry.get('id'));
      if ( existing.get('length') ) {
        throw new Error(this.get('intl').t('editRegistry.credentialAppeared'));
      }
      if ( this.get('credentialOutcomeUnknown') ) {
        throw new Error(this.get('intl').t('editRegistry.credentialOutcomeUnknown'));
      }

      return resolve().then(() => {
        if ( !this.get('canSaveCredential') ) {
          throw {status: 403, code: 'Forbidden', messageKey: 'resourceSaveError.unavailable'};
        }

        this.set('credentialSaveAttempted', true);
        return this.get('primaryResource').save();
      }).then(
        (saved) => this.mergeResult(saved),
        (error) => {
          this.set('credentialOutcomeUnknown', !definitelyRejected(error));
          throw error;
        }
      );
    });
  },

  doneSaving: function() {
    this.send('cancel');
  },
});
