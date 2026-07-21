import Ember from 'ember';

export default Ember.Component.extend({
  classNames: ['console-workspace-root'],
  workspace: Ember.inject.service('console-workspace'),
  intl: Ember.inject.service(),

  didInsertElement() {
    this._super(...arguments);
    this.get('workspace').activate();
  },

  actions: {
    toggleMenu() {
      this.get('workspace').toggleMenu();
    },

    open(entry) {
      this.get('workspace').openWindow(entry);
    },

    terminate(entry) {
      let message = this.get('intl').t('consoleWorkspace.session.confirmTerminate');
      if (window.confirm(message)) {
        this.get('workspace').terminateSession(entry);
      }
    },

    remove(entry) {
      this.get('workspace').removeHistory(entry);
    },
  },
});
