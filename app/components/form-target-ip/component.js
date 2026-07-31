import { get, observer } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  actions: {
    addTargetIp: function() {
      this.get('targetIpArray').pushObject({value: null});
    },
    removeTargetIp: function(obj) {
      this.get('targetIpArray').removeObject(obj);
    },
  },

  which         : null,
  userHostname  : null,
  targetIpArray : null,

  init() {
    this._super(...arguments);

    var hostname = this.get('service.hostname');
    if ( hostname )
    {
      this.set('userHostname', hostname);
      this.set('which','hostname');
      this.set('targetIpArray',[]);
    }
    else
    {
      var ips = this.get('service.externalIpAddresses');
      var out = [];
      if ( ips )
      {
        ips.forEach((ip) => {
          out.push({ value: ip });
        });
      }
      else
      {
        out.push({value: null});
      }

      this.set('targetIpArray', out);
      this.set('which','ip');
    }
  },

  valuesDidChange: observer('targetIpArray.@each.{value}', 'userHostname', 'which', function() {
    if ( this.get('which') === 'hostname' )
    {
      this.setProperties({
        'service.hostname': this.get('userHostname'),
        'service.externalIpAddresses': null
      });
    }
    else
    {
      var targets = this.get('targetIpArray');
      if ( targets )
      {
        var out =  targets.filterBy('value').map((choice) => {
          return get(choice,'value');
        }).uniq();

        this.setProperties({
          'service.hostname': null,
          'service.externalIpAddresses': out
        });
      }
    }
  }),
});
