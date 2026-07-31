import { next } from '@ember/runloop';
import Component from '@ember/component';
import Sortable from 'ui/mixins/sortable';

export default Component.extend(Sortable, {
  expandAll: false,

  actions: {
    expandChildren: function() {
      next(() => {
      this.toggleProperty('expandAll');
      });
    }
  }
});
