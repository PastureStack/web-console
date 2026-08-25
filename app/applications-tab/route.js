import EmberObject from '@ember/object';
import { all } from 'rsvp';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  projects: service(),

  model: function() {
    var store = this.get('store');
    return all([
      store.findAll('stack'),
      store.findAll('service'),
    ]).then((results) => {
      return EmberObject.create({
        stacks: results[0],
        services: results[1],
      });
    });
  },
});
