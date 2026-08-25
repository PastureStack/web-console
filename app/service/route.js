import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
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
      });
    }
  },
});
