import EmberObject from '@ember/object';
import Route from '@ember/routing/route';

export default Route.extend({
  model: function(params) {
    return this.get('store').findAll('host').then((all) => {
      return this.get('store').find('host', params.host_id).then((host) => {
        return EmberObject.create({
          all: all,
          host: host,
        });
      });
    });
  },
});
