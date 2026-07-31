import EmberObject, { computed } from '@ember/object';
import { alias, sort } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';
import { parseExternalId } from 'ui/utils/parse-externalid';

export default Component.extend({
  prefs             : service(),
  projects          : service(),
  hasVm             : alias('projects.current.virtualMachine'),

  model             : null,
  single            : false,
  showAddService    : true,

  collapsed         : true,
  classNames        : ['stack-section'],

  sortedServices    : sort('model.services','sortBy'),
  sortBy: ['name','id'],

  actions: {
    toggleCollapse() {
      var collapsed = this.toggleProperty('collapsed');
      var list = this.get('prefs.'+C.PREFS.EXPANDED_STACKS)||[];
      let id = this.get('model.id');
      if ( collapsed )
      {
        list.removeObject(id);
      }
      else if (!list.includes(id))
      {
        // Add at the front
        list.unshift(id);
      }

      // Cut off the back to keep the list reasonable
      if ( list.length > 100 ) {
        list.length = 100;
      }

      this.get('prefs').set(C.PREFS.EXPANDED_STACKS, list);
    },

    addtlInfo(service) {
      this.sendAction('showAddtlInfo', service);
    },

    upgradeImage(service) {
      service.send('upgrade','true');
    }
  },

  init() {
    this._super(...arguments);

    var list = this.get('prefs.'+C.PREFS.EXPANDED_STACKS)||[];
    if ( list.indexOf(this.get('model.id')) >= 0 )
    {
      this.set('collapsed', false);
    }
  },

  isKubernetes: computed('model.externalId', function() {
    var parts = parseExternalId(this.get('model.externalId'));
    return parts && parts.kind === C.EXTERNAL_ID.KIND_KUBERNETES;
  }),


  instanceCount: computed('model.services.@each.instanceCount', function() {
    var count = 0;
    (this.get('model.services')||[]).forEach((service) => {
      count += service.get('instanceCount')||0;
    });

    return count;
  }),

  outputs: computed('model.outputs', 'model.id', function() {
    var out = [];
    var map = this.get('model.outputs')||{};
    Object.keys(map).forEach((key) => {
      out.push(EmberObject.create({
        key: key,
        value: map[key],
      }));
    });

    return out;
  }),
});
