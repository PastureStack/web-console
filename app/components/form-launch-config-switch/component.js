import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({
  projects     : service(),
  hasVm        : alias('projects.current.virtualMachine'),

  index        : null,
  choices      : null,
  showAdd      : true,
  initialIndex : -1,

  actions: {
    switch(index) {
      this.sendAction('switch', index);
    },

    add(vm) {
      this.sendAction('add', vm);
    },
  },

  init() {
    this._super(...arguments);
    this.send('switch', this.get('initialIndex'));
  },

  hasSidekicks: computed('choices.length', function() {
    return this.get('choices.length') > 1;
  }),

  enabledChoices: computed('choices.@each.enabled', function() {
    return this.get('choices').filterBy('enabled',true);
  })
});
