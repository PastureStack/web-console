import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','serviceId','tab','upgrade','upgradeImage'],
  stackId: null,
  serviceId: null,
  tab: 'ssl',
  upgrade: null,
  upgradeImage: 'false',

  actions: {
    done(savedService) {
      let stackId = savedService && (typeof savedService.get === 'function' ? savedService.get('stackId') : savedService.stackId);

      return this.get('router').transitionTo('stack', stackId || this.get('stackId'));
    },

    cancel() {
      this.send('goToPrevious');
    },
  },
});
