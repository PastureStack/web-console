import EmberObject from '@ember/object';
import { service } from '@ember/service';
import Route from '@ember/routing/route';
import resourceLoadError from 'ui/utils/resource-load-error';

export default Route.extend({
  intl: service(),

  model: function(params) {
    var store = this.get('store');
    var all = this.modelFor('stacks');
    return store.find('stack', params.stack_id).then((stack) => {
      return EmberObject.create({
        stack: stack,
        all: all,
      });
    }, (err) => {
      throw resourceLoadError(err, this.get('intl'),
        'resourceLoadError.stackUnavailable', 'resourceLoadError.stackFailed');
    });
  },
});
