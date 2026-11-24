import Component from '@ember/component';

export default Component.extend({
  tagName: '',
  service: null,
  actions: {
    upgradeImage() {
      let service = this.get('service');
      if ( service && service.get('imageUpgradeAvailable') ) {
        service.send('upgrade', 'true');
      }
    },
  },
});
