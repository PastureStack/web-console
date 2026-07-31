import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    var store = this.get('store');
    return hash({
      hosts: store.findAll('host'),
      instances: store.findAll('instance'),
    }).then((hash) => {
      return hash.hosts;
    });
  },
});
