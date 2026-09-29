import { service } from '@ember/service';
import Component from '@ember/component';
import { resolve } from 'rsvp';
import Errors from 'ui/utils/errors';

export default Component.extend({
  classNames: ['project-upgrade'],

  access: service(),
  intl: service(),
  projects: service(),
  settings: service(),
  errorMessage: null,
  isUpgrading: false,

  isOwner: function() {
    let projectId = this.get('projects.current.id');
    return !!projectId && this.get('projects.schemaProjectId') === projectId &&
      this.get('access').isOwner();
  }.property('projects.current.id', 'projects.schemaProjectId', 'projects.schemaLoadGeneration'),

  canUpgrade: function() {
    return this.get('isOwner') && !!this.get('projects.current.actionLinks.upgrade');
  }.property('isOwner', 'projects.current.actionLinks.upgrade'),

  actions: {
    upgrade() {
      if ( !this.get('canUpgrade') || this.get('isUpgrading') ) {
        return;
      }

      const project = this.get('projects.current');
      const projectId = project && project.get('id');
      this.setProperties({errorMessage: null, isUpgrading: true});
      return resolve().then(() => {
        // The action starts on a later turn. A tab may switch projects before
        // that turn; never send its click to whichever project is current now.
        if (this.get('projects.current') !== project || !projectId ||
            project.get('id') !== projectId ||
            this.get('projects.schemaProjectId') !== projectId ||
            !project.get('actionLinks.upgrade') || !this.get('access').isOwner()) {
          throw {status: 403};
        }
        return project.doAction('upgrade');
      })
        .catch((err) => {
          this.set('errorMessage', Errors.stringify(err, this.get('intl')));
          return false;
        }).finally(() => this.set('isUpgrading', false));
    },
  },
});
