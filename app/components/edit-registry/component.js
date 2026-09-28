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
  missingCredential: false,
  credentialSaveAttempted: false,
  credentialOutcomeUnknown: false,

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
    if ( !this.get('missingCredential') ) {
      return this._super(...arguments);
    }

    const registry = this.get('originalModel.registry');
    return registry.get('store').find('registrycredential', null, {forceReload: true}).then((credentials) => {
      const existing = credentialsForRegistry(credentials, registry.get('id'));
      if ( existing.get('length') ) {
        throw new Error(this.get('intl').t('editRegistry.credentialAppeared'));
      }
      if ( this.get('credentialOutcomeUnknown') ) {
        throw new Error(this.get('intl').t('editRegistry.credentialOutcomeUnknown'));
      }

      this.set('credentialSaveAttempted', true);
      return resolve().then(() => this.get('primaryResource').save()).then(
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
