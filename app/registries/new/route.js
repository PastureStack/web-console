import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { resolve } from 'rsvp';

export default Route.extend({
  projects: service(),
  intl: service(),

  beforeModel() {
    let parent = this._super(...arguments);

    return resolve(parent).then(() => {
      let projects = this.get('projects');
      if (!projects.canCreateResource('registry') || !projects.canCreateResource('registryCredential')) {
        const titleKey = 'registriesPage.index.linkTo';
        const messageKey = 'registriesPage.permissionDenied';
        throw {
          status: 403,
          code: 'Forbidden',
          title: this.get('intl').t(titleKey),
          titleKey,
          message: this.get('intl').t(messageKey),
          messageKey,
        };
      }
    });
  },

  model: function(/*params, transition*/) {
    var store = this.get('store');
    var registry = store.createRecord({
      type:'registry',
      serverAddress: '',
    });

    var credential = store.createRecord({
      type:'registryCredential',
      registryId: 'tbd',
      email: "not-really@required.anymore"
    });

    return store.find('registry').then((registries) => {
      return EmberObject.create({
        allRegistries: registries,
        registry: registry,
        credential: credential
      });
    });
  },

  setupController: function(controller, model) {
    controller.set('model',model);
    controller.setProperties({
      registryCreated: false,
      registrySaveAttempted: false,
      registryOutcomeUnknown: false,
      credentialSaveAttempted: false,
      credentialOutcomeUnknown: false,
      credentialSaved: false,
      savedCredentialId: null,
    });
    controller.send('selectDriver','dockerhub');
  },

  resetController: function (controller, isExiting/*, transition*/) {
    if (isExiting)
    {
      controller.set('errors', null);
      controller.setProperties({
        registryCreated: false,
        registrySaveAttempted: false,
        registryOutcomeUnknown: false,
        credentialSaveAttempted: false,
        credentialOutcomeUnknown: false,
        credentialSaved: false,
        savedCredentialId: null,
      });
    }
  },
});
