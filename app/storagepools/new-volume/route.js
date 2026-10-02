import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import RequireCreatePermission from 'ui/mixins/require-create-permission';

export default Route.extend(RequireCreatePermission, {
  requiredCreateType: 'volume',

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
