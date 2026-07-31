import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    let store = this.get('store');
    return hash({
      pools:     store.findAll('storagepool'),
      mounts:    store.findAll('mounts', {filter: {'state_ne': 'inactive'}}),
    }).then((hash) => {
      return hash.pools.filter((pool) => {
        return !!pool.get('driverName');
      });
    });
  },
});
