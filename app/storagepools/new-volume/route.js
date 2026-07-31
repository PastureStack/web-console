import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(params/*, transition*/) {
    var store = this.get('store');

    return EmberObject.create({
      volume: store.createRecord({
        type: 'volume',
        driver: params.driverName,
        name: '',
        driverOpts: {},
      }),
    });
  },

  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('errors', null);
    }
  }
});
