import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  webhookStore: service(),
  intl: service(),

  beforeModel() {
    let parent = this._super(...arguments);

    return resolve(parent).then(() => {
      if ( !this.get('webhookStore').canCreate('receiver') ) {
        const titleKey = 'hookPage.receiver.buttonText';
        const messageKey = 'hookPage.receiver.permissionDenied';
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

  model(params) {
    let promise;
    let store = this.get('webhookStore');
    if ( params.receiverId ) {
      promise = store.find('receiver', params.receiverId);
    } else {
      promise = resolve(store.createRecord({
        type: 'receiver',
        driver: 'scaleService',
      }));
    }

    return promise.then((receiver) => {
      let copy = receiver.cloneForNew();

      // A Receiver URL is a server-issued capability. Cloning its settings
      // must not copy the old capability or the old lifecycle state.
      delete copy.url;
      delete copy.state;
      return EmberObject.create({
        receiver: copy,
      });
    });
  },

  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('errors', null);
      controller.set('receiverId', null);
    }
  }
});
