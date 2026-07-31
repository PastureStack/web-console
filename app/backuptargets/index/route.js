import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    return EmberObject.create({
      all: this.modelFor('backuptargets')
    });
  }
});
