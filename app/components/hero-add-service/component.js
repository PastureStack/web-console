import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),

  showUser: true,
  catalog: null,

  stackId: null,

  actions: {
    newService() {
      var stackId = this.get('stackId');

      if ( stackId )
      {
        this.get('router').transitionTo('service.new', {queryParams: {stackId: stackId}});
      }
      else
      {
        var stack = this.get('store').createRecord({
          type: 'stack',
          name: 'Default',
        });

        return stack.save().then(() => {
          this.get('router').transitionTo('service.new', {queryParams: {stackId: stack.get('id') }});
        });
      }
    },
  }
});
