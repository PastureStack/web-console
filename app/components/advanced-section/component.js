import Component from '@ember/component';

export default Component.extend({
  advanced: false,

  tagName: null,

  actions: {
    toggle() {
      this.set('advanced', !this.get('advanced'));
    },
  },
});
