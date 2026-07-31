import { on } from '@ember/object/evented';
import { service } from '@ember/service';
import Component from '@ember/component';

import { computed, observer } from '@ember/object';

export default Component.extend({
  tagName    : '',
  expanded   : false,
  expandAll  : false,
  expandSelf : false,
  depth      : 0,
  modalService: service('modal'),

  actions: {
    expand: function() {
      this.toggleProperty('expanded');
    },
    showError: function(model) {
      this.get('modalService').toggleModal('modal-process-error', model);
    }
  },

  setup: on('init', function() {

    if (this.get('nodeDepth')) {
      this.set('depth', this.incrementProperty('nodeDepth'));
    } else {
      this.set('depth', 1);
    }
  }),

  checkProcessHandlerExecutions: computed(function() {
    if (this.get('execution').hasOwnProperty('processHandlerExecutions') && this.get('execution').processHandlerExecutions.length > 0) {
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
