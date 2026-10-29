import Service, { service } from '@ember/service';
import Evented from '@ember/object/evented';
import { CommandContext } from 'ui/utils/ai-command-context';

export default Service.extend(Evented, {
  authSession: service('auth-session'),
  projects: service(),
  router: service(),

  init() {
    this._super(...arguments);
    this.context = new CommandContext(() => ({
      generation: this.get('authSession.tabGeneration'),
      accountId: this.get('authSession.accountId'),
      projectId: this.get('projects.current.id'),
      projectName: this.get('projects.current.name'),
      schemaProjectId: this.get('projects.schemaProjectId'),
      schemaGeneration: this.get('projects.schemaLoadGeneration'),
      route: `${this.get('router.currentRouteName') || ''}:${this.get('router.currentURL') || ''}`,
    }));
    this.get('authSession').on('changed', this, this.invalidate);
  },

  invalidate() {
    if ( this.context ) { this.context.invalidate(); this.trigger('changed'); }
  },

  contextChanged: function() { this.invalidate(); }
    .observes('authSession.tabGeneration', 'authSession.accountId', 'projects.current.id',
      'projects.schemaProjectId', 'projects.schemaLoadGeneration', 'router.currentRouteName', 'router.currentURL'),

  willDestroy() {
    this.get('authSession').off('changed', this, this.invalidate);
    this.context.setMode('off');
    this._super(...arguments);
  },
});
