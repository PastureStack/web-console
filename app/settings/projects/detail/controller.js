import Controller from '@ember/controller';

export default Controller.extend({
  model: null,
  editing: false,
  tab: 'access',

  queryParams: ['editing','tab'],

  actions: {
    done() {
      this.transitionToRoute('settings.projects');
    },

    cancel() {
      this.transitionToRoute('settings.projects');
    },
  },
});
