import Ember from 'ember';

export default Ember.Component.extend({
  classNames: ['console-workspace-root'],
  workspace: Ember.inject.service('console-workspace'),

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
      this.get('workspace').requestTermination(entry);
    },

    cancelTerminate() {
      this.get('workspace').cancelTermination();
    },

    confirmTerminate() {
      this.get('workspace').confirmTermination();
    },

    remove(entry) {
      this.get('workspace').removeHistory(entry);
    },
  },
});
