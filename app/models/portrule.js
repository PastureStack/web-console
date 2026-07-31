import { later } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import Resource from 'ember-api-store/models/resource';
import { denormalizeId } from 'ember-api-store/utils/denormalize';

import { computed, observer } from '@ember/object';

function setTlsPort() {
  if ( this.get('targetPort') ) {
    return;
  }

  let proto = this.get('protocol').toLowerCase();
  let src = parseInt(this.get('sourcePort'),10);
  let tgt = null;

  if ( (proto === 'http' && src === 80) || ( proto === 'https' && src === 443) ) {
    tgt = 80;
  } else if ( proto === 'sni' && src === 443 ) {
    tgt = 443;
  }

  if ( tgt ) {
    this.set('targetPort', tgt);
  }
}

let PortRule = Resource.extend({
  type: 'portRule',
  reservedKeys: ['access','isSelector'],

  service: denormalizeId('serviceId'),

  isTls: computed('protocol', function() {
    return ['tls','https','sni'].includes(this.get('protocol'));
  }),

  needsCertificate: computed('protocol', function() {
    return ['tls','https'].includes(this.get('protocol'));
  }),

  canHostname: computed('protocol', function() {
    return ['http','https','sni'].includes(this.get('protocol'));
  }),

  canPath: computed('protocol', function() {
    return ['http','https'].includes(this.get('protocol'));
  }),

  canSticky: alias('canPath'),

  ipProtocol: computed('protocol', function() {
    if ( this.get('protocol') === 'udp' ) {
      return 'udp';
    } else {
      return 'tcp';
    }
  }),

  autoSetPort: observer('protocol', 'sourcePort', function() {
    later(this, setTlsPort, 500);
  }),
});

export default PortRule;
