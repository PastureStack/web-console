import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','serviceId','tab','upgrade','upgradeImage'],
  stackId: null,
  serviceId: null,
  tab: 'ssl',
  upgrade: null,
  upgradeImage: 'false',

  actions: {
    done() {
      return this.transitionToRoute('stack', this.get('model.service.stackId'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
