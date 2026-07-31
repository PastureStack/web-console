import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(params) {
    var store = this.get('store');
    var all = this.modelFor('stacks');
    return store.find('stack', params.stack_id).then((stack) => {
      return EmberObject.create({
        stack: stack,
        all: all,
      });
    });
  },
});
