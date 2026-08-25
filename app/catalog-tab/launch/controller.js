import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['stackId','upgrade'],
  stackId: null,
  upgrade: null,

  parentRoute: 'catalog-tab',

  actions: {
    cancel() {
      this.get('router').transitionTo(this.get('parentRoute'));
    }
  },
});
