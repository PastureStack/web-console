import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import resourceLoadError from 'ui/utils/resource-load-error';

export default Route.extend({
  intl: service(),

  model: function(params) {
    var stack = this.modelFor('stack');
    var service = this.get('store').getById('service', params.service_id);
    if ( service )
    {
      return EmberObject.create({
        service: service,
        stack: stack.get('stack'),
      });
    }
    else
    {
      return this.get('store').find('service', params.service_id).then((service) => {
        return EmberObject.create({
          service: service,
          stack: stack.get('stack'),
        });
      }, (err) => {
        throw resourceLoadError(err, this.get('intl'),
          'resourceLoadError.serviceUnavailable', 'resourceLoadError.serviceFailed');
      });
    }
  },
});
