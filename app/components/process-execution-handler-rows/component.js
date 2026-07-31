import { service } from '@ember/service';
import Component from '@ember/component';

import { computed, observer } from '@ember/object';
import { on } from '@ember/object/evented';

export default Component.extend({
  tagName              : '',
  expanded             : false,
  depth                : 0,
  expandAll : false,
  modalService: service('modal'),

  actions: {
    expand: function() {
      this.toggleProperty('expanded');
    },
    showError: function(model) {
      this.get('modalService').toggleModal('modal-process-error', model);
    }
  },

  init() {
    this._super(...arguments);
    if (this.get('nodeDepth')) {
      this.set('depth', this.incrementProperty('nodeDepth'));
    } else {
      this.set('depth', 1);
    }
  },

  checkExecutions: computed(function() {
    if (this.get('execution').children.length > 0) {
      return true;
    } else {
      return false;
    }
  }),

  expandChildren: on('init', observer('expandAll', function() {
    if (this.get('expandAll')) {
      this.set('expanded', true);
    } else {
      this.set('expanded', false);
    }
  }))
});
