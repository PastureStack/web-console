import { later } from '@ember/runloop';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  shibbolethAuth: service(),
  intl              : service(),
  queryParams: {
    shibbolethTest: {
      refreshModel:false
    },
    errCode: {
      refreshModel:false
    }
  },
  model: function(params, transition) {
    if (params.shibbolethTest && !params.errCode) {
      reply(null);
    } else if (params.errCode) {
      let errMessage = '';
      switch (params.errCode) {
      case '401':
        errMessage = this.get('intl').t('loginPage.shibbolethError.401');
        break;
      case '403':
        errMessage = this.get('intl').t('loginPage.shibbolethError.403');
        break;
      case '422':
        errMessage = this.get('intl').t('loginPage.shibbolethError.422');
        break;
      case '500':
        errMessage = this.get('intl').t('loginPage.shibbolethError.500');
        break;
      default:
        errMessage = this.get('intl').t('loginPage.shibbolethError.generic', { errorCode: params.errCode });
        break;
      }

      transition.abort();
      this.transitionTo('login', {queryParams: { errorMsg: errMessage}});

    } else {
      if (this.get('shibbolethAuth.hasToken')) {
        this.transitionTo('authenticated');
      } else {
        this.transitionTo('login');
      }

    }

    function reply(err) {
      try {
        window.opener.window.onShibbolethTest(err);
        later(() => {
          window.close();
        },250);
      } catch(e) {
        window.close();
      }
    }
  },
  setupController: function(controller) {
    controller.set('settings', service('settings'));
  },

});
