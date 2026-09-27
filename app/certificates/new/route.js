import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { resolve } from 'rsvp';

export default Route.extend({
  projects: service(),
  intl: service(),

  beforeModel() {
    let parent = this._super(...arguments);

    return resolve(parent).then(() => {
      if (!this.get('projects').canCreateResource('certificate')) {
        const titleKey = 'certificatesPage.index.linkTo';
        const messageKey = 'certificatesPage.permissionDenied';
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
    return this.get('store').createRecord({
      type: 'certificate'
    });
  },

  resetController: function (controller, isExiting/*, transition*/) {
    if (isExiting)
    {
      controller.set('errors', null);
    }
  }
});
