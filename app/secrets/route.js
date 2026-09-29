import { service } from '@ember/service';
import Route from '@ember/routing/route';
import resourceLoadError from 'ui/utils/resource-load-error';

export default Route.extend({
  intl: service(),

  model: function() {
    return this.get('store').findAll('secret').then(null, (err) => {
      throw resourceLoadError(err, this.get('intl'),
        'resourceLoadError.secretsUnavailable', 'resourceLoadError.secretsFailed');
    });
  },
});
