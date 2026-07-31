import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var store = this.get('store');
    return hash({
      instances: store.findAll('instance'),
      hosts: store.findAll('host'),
    }).then(() => {
      return store.all('container');
    });
  },
});
