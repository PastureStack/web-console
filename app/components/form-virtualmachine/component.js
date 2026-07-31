import Component from '@ember/component';

export default Component.extend({
  launchConfig : null,

  classNames   : ['r-pt10'],

  init() {
    this._super(...arguments);

    if ( !this.get('launchConfig.memoryMb') )
    {
      this.set('launchConfig.memoryMb', 512);
    }
  },
});
