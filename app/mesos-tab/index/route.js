import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  mesos: service(),

  model() {
    return this.get('mesos').publicUrl().then((url) => {
      return EmberObject.create({
        url: url,
        hosts: this.modelFor('authenticated').get('hosts'),
      });
    }).catch(() => {
      return EmberObject.create({
        url: null,
        hosts: this.modelFor('authenticated').get('hosts'),
        ready: false,
      });
    });
  }
});
