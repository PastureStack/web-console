import { equal, alias, or } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import ManageLabels from 'ui/mixins/manage-labels';
import GroupedInstances from 'ui/mixins/grouped-instances';

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

  shouldUpdateLabels: function() {
    this.initLabels(this.get('model.labels'));
  }.observes('model.labels'),

  filteredInstances: function() {
    let out = this.get('model.instances')||[];
    //out = out.filterBy('isRemoved', false);

    if ( this.get('show') === 'standard' ) {
      out = out.filterBy('isSystem', false);
    }


    return out;
  }.property('model.instances.@each.labels','show'),

  arrangedInstances: function() {
    return this.get('filteredInstances').sortBy('name','id');
  }.property('filteredInstances.@each.{name,id}'),

  isActive: equal('model.state','active'),
  isProvisioning: equal('model.state','provisioning'),
  isError: equal('model.state','error'),
  showAdd: alias('isActive'),
  showOnlyMessage: or('isProvisioning','isError'),

  stateBackground: function() {
    return this.get('model.stateColor').replace("text-","bg-");
  }.property('model.stateColor'),

});
