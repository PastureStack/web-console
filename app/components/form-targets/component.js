import { scheduleOnce } from '@ember/runloop';
import EmberObject, { get, computed, observer } from '@ember/object';
import { service } from '@ember/service';
import Component from '@ember/component';
import { stringifyTarget } from 'ui/utils/parse-target';

export default Component.extend({
  intl        : service(),

  existing    : null,
  exclude     : null,
  isBalancer  : null,
  editing     : false,

  classNames  : ['form-group'],

  actions: {
    addTargetService: function() {
      this.get('targetsArray').pushObject(EmberObject.create({isService: true, value: null}));
    },
    removeTarget: function(obj) {
      this.get('targetsArray').removeObject(obj);
    },

    setAdvanced: function() {
      this.set('isAdvanced', true);
    },
  },

  isAdvanced: false,
  targetsArray: null,

  init() {
    this._super(...arguments);

    this.set('isAdvanced', this.get('editing'));

    var out = [];

    var existing = this.get('existing');
    if ( existing && existing.get('linkedServices') !== null )
    {
      let links = existing.get('linkedServices');
      Object.keys(links).forEach((key) => {
        out.pushObject(EmberObject.create({
          isService: true,
          value: links[key],
        }));
      });
    }
    else
    {
      out.pushObject(EmberObject.create({
        isService: true,
        value: null
      }));
    }

    scheduleOnce('afterRender', () => {
      this.set('targetsArray', out);
      this.targetsChanged();
    });
  },

  targetResources: computed(
    'targetsArray.@each.{isService,value,hostname,path,srcPort,dstPort}',
    function() {
      var out = [];
      var array = this.get('targetsArray');
      array.filterBy('isService',true).filterBy('value').map((choice) => {
        var serviceId = get(choice,'value');

        var entry = out.filterBy('serviceId', serviceId)[0];
        if ( !entry )
        {
          entry = EmberObject.create({
            serviceId: serviceId,
            ports: [],
          });
          out.pushObject(entry);
        }

        var str = stringifyTarget(choice);
        if ( str )
        {
          entry.get('ports').pushObject(str);
        }
      });

      return out;
    }
  ),

  targetsChanged: observer('targetResources', 'targetResources.@each.{serviceId,ports}', function() {
    this.sendAction('changed', this.get('targetsArray'), this.get('targetResources'));
  }),

  hasAdvancedSourcePorts: computed('targetsArray.@each.{isService,srcPort}', function() {
    return this.get('targetsArray').filterBy('isService',true).filter((target) => {
      return parseInt(target.get('srcPort'),10) > 0;
    }).get('length') > 0;
  }),
});
