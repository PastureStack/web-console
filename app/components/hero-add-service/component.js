import { computed } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  settings: service(),
  projects: service(),

  showUser: true,
  catalog: null,

  stackId: null,

  canAddService: computed('projects.current.id', 'projects.schemaProjectId', 'stackId', function() {
    return this.get('projects').canCreateResource('service') &&
      (Boolean(this.get('stackId')) || this.get('projects').canCreateResource('stack'));
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
