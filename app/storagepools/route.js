import { hash } from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function() {
    let store = this.get('store');
    return hash({
      pools:     store.findAll('storagepool'),
      // Keep inactive mounts too: a stopped workload still owns its volume.
      mounts:    store.findAll('mount'),
      volumes:   store.findAll('volume'),
    }).then((hash) => {
      return hash.pools.filter((pool) => {
        return !!pool.get('driverName');
      });
    });
  },
});
