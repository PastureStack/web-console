import { computed, observer } from '@ember/object';
import { scheduleOnce } from '@ember/runloop';
import Component from '@ember/component';
import ManageLabels from 'ui/mixins/manage-labels';

export default Component.extend(ManageLabels, {
  // Inputs
  // Global scale scheduling
  isGlobal: false,

  // Is this for a service(=true) or container(=false)
  isService: false,

  // Request a specific host
  requestedHostId: null,

  // Is requesting a specific host allowed
  canRequestHost: true,

  // Initial labels and host to start with
  initialLabels: null,
  initialHostId: null,

  // labelArray -> the labels that should be set for the scheduling rules

  // Actions output
  // setLabels(labelArray)
  // setGlobal(boolean)
  // setRequestedHost(hostId)

  // Internal properties
  isRequestedHost: false,

  classNameBindings: ['editing:component-editing:component-static'],
  editing: true,


  actions: {
    addSchedulingRule() {
      this.send('addAffinityLabel');
    },

    removeSchedulingRule(obj) {
      this.send('removeLabel', obj);
    },
  },

  init() {
    this._super(...arguments);

    this.set('allHosts', this.get('store').all('host'));

    this.initLabels(this.get('initialLabels'), 'affinity');

    if ( this.get('isGlobal') )
    {
      this.setProperties({
        isRequestedHost: false,
        requestedHostId: null,
      });
      scheduleOnce('afterRender', () => {
        this.sendAction('setGlobal', true);
        this.sendAction('setRequestedHost', null);
      });
    }
    else if ( this.get('initialHostId') )
    {
      this.setProperties({
        isRequestedHost: true,
        requestedHostId: this.get('initialHostId'),
      });

      scheduleOnce('afterRender', () => {
        this.sendAction('setGlobal', false);
        this.sendAction('setRequestedHost', this.get('requestedHostId'));
      });
    }
  },

  updateLabels(labels) {
    this.sendAction('setLabels', labels);
  },

  globalDidChange: observer('isGlobal', function() {
    if ( this.get('isGlobal') )
    {
      this.set('isRequestedHost',false);
    }
  }),

  isRequestedHostDidChange: observer('isRequestedHost', function() {
    if ( this.get('isRequestedHost') )
    {
      var hostId = this.get('requestedHostId') || this.get('hostChoices.firstObject.id');
      this.set('requestedHostId', hostId);
    }
    else
    {
      this.set('requestedHostId', null);
    }
  }),

  requestedHostIdDidChange: observer('requestedHostId', function() {
    var hostId = this.get('requestedHostId');

    if ( hostId )
    {
      this.set('isRequestedHost', true);
      this.sendAction('setGlobal', false);
    }

    this.sendAction('setRequestedHost', hostId);
  }),

  selectedChoice: computed('allHosts.@each.{id,name,state}', function() {
    return this.get('hostChoices').findBy('id', this.get('initialHostId'));
  }),

  hostChoices: computed('allHosts.@each.{id,name,state}', function() {
    var list = this.get('allHosts').map((host) => {
      var hostLabel = host.get('displayName');
      if ( host.get('state') !== 'active' )
      {
        hostLabel += ' (' + host.get('state') + ')';
      }

      return {
        id: host.get('id'),
        name: hostLabel,
      };
    });

    return list.sortBy('name','id');
  }),

});
