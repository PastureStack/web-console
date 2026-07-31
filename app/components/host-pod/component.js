import { equal, alias, or } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import ManageLabels from 'ui/mixins/manage-labels';
import GroupedInstances from 'ui/mixins/grouped-instances';

import { observer, computed } from '@ember/object';

export default Component.extend(ManageLabels, GroupedInstances, {
  settings: service(),

  model: null,
  mode: null,
  show: null,

  classNames: ['pod','host'],

  init() {
    this._super(...arguments);

    this.initLabels(this.get('model.labels'));
  },

  actions: {
    newContainer() {
      this.sendAction('newContainer', this.get('model.id'));
    },
  },

  shouldUpdateLabels: observer('model.labels', function() {
    this.initLabels(this.get('model.labels'));
  }),

  filteredInstances: computed('model.instances.@each.labels', 'show', function() {
    let out = this.get('model.instances')||[];
    //out = out.filterBy('isRemoved', false);

    if ( this.get('show') === 'standard' ) {
      out = out.filterBy('isSystem', false);
    }


    return out;
  }),

  arrangedInstances: computed('filteredInstances.@each.{name,id}', function() {
    return this.get('filteredInstances').sortBy('name','id');
  }),

  isActive: equal('model.state','active'),
  isProvisioning: equal('model.state','provisioning'),
  isError: equal('model.state','error'),
  showAdd: alias('isActive'),
  showOnlyMessage: or('isProvisioning','isError'),

  stateBackground: computed('model.stateColor', function() {
    return this.get('model.stateColor').replace("text-","bg-");
  }),

});
