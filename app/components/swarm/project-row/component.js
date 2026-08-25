import Component from '@ember/component';

export default Component.extend({
  model: null,
  expanded: false,

  tagName: '',

  actions: {
    toggleExpand() {
      this.toggleProperty('expanded');
    }
  },

});
