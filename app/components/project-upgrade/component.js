import { service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  classNames: ['project-upgrade'],

  access: service(),
  projects: service(),
  settings: service(),

  canUpgrade: function() {
    return this.get('access').isOwner();
  }.property('projects.current.id'),

  actions: {
    upgrade() {
      this.get('projects.current').doAction('upgrade');
    },
  },
});
