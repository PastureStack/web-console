import { service } from '@ember/service';
import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  classNames: ['project-upgrade'],

  access: service(),
  projects: service(),
  settings: service(),

  canUpgrade: computed('projects.current.id', function() {
    return this.get('access').isOwner();
  }),

  actions: {
    upgrade() {
      this.get('projects.current').doAction('upgrade');
    },
  },
});
