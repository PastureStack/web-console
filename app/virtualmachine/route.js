import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(params) {
    var store = this.get('store');

    return store.find('virtualmachine', params.virtualmachine_id).then(function(vm) {
      return EmberObject.create({
        vm: vm,
      });
    });
  },
});
