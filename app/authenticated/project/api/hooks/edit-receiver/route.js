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
      let schema = this.get('webhookStore').getById('schema', 'receiver');
      let methods = schema && schema.get('resourceMethods');

      if ( !methods || !methods.includes('PUT') ) {
        throw {
          status: 403,
          code: 'Forbidden',
          title: this.get('intl').t('newReceiver.title.edit'),
          message: this.get('intl').t('hookPage.receiver.editPermissionDenied'),
        };
      }
    });
  },

  model(params) {
    return this.get('webhookStore').find('receiver', params.receiver_id).then((receiver) => {
      return EmberObject.create({
        receiver: receiver,
      });
    });
  },

  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('errors', null);
    }
  }
});
