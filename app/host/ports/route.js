import { all } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var host = this.modelFor('host').get('host');
    var store = this.get('store');

    return all([
      store.findAll('service'),
      store.findAll('instance'),
    ]).then(() => {
      return host;
    });
  }
});
