import { computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),
  projects: service(),

  showUser: true,
  catalog: null,

  stackId: null,

  canAddService: computed('projects.current.id', 'stackId', function() {
    return this.get('store').canCreate('service') &&
      (Boolean(this.get('stackId')) || this.get('store').canCreate('stack'));
  }),

  actions: {
    newService() {
      if ( !this.get('canAddService') ) {
        return;
      }

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
