import Route from '@ember/routing/route';

export default Route.extend({
  resetController: function (controller, isExisting/*, transition*/) {
    if (isExisting)
    {
      controller.set('showAddtlInfo', false);
    }
  },
});
