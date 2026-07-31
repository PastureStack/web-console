import Ember from 'ember';
import Resource from 'ember-api-store/models/resource';

var Port = Resource.extend({
  intl: Ember.inject.service(),
  _publicIp: null,
  _publicIpState: null,
  displayPublicIp: function() {
    var bind = this.get('bindAddress');
    if ( bind )
    {
      return bind;
    }
    else if ( !this.get('publicPort') )
    {
      return null;
    }

    var ip = this.get('_publicIp');
    if ( ip )
    {
      return ip;
    }
    else if ( this.get('_publicIpState') === 2 )
    {
      return `(${this.get('intl').t('formatIp.unknownIp')})`;
    }
    else if ( !this.get('_publicIpState') )
    {
      this.set('_publicIpState', 1);
      this.get('store').find('ipaddress', this.get('publicIpAddressId')).then((ip) => {
        this.set('_publicIp', ip.get('address'));
      }).finally(() => {
        this.set('_publicIpState', 2);
      });

      return this.get('intl').t('generic.loading');
    }

    return null;
  }.property('_publicIpState','_publicIp','publicIpAddressId','bindAddress','publicPort','intl._locale'),
});

export default Port;
