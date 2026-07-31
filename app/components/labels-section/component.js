import { observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import ManageLabels from 'ui/mixins/manage-labels';
import Sortable from 'ui/mixins/sortable';

export default Component.extend(ManageLabels, Sortable, {
  model           : null,

  labelSource     : alias('model.labels'),
  sortableContent : alias('labelArray'),
  sortBy          : 'kind',
  showKind        : true,
  descending      : true,

  sorts: {
    kind  : ['type','key'],
    key   : ['key'],
    value : ['value','key'],
  },

  labelsObserver: observer('model.labels', function () {
    this.initLabels(this.get('labelSource'));
  }),

  didReceiveAttrs() {
    this.initLabels(this.get('labelSource'));
  },
});
