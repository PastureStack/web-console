import Service from 'ui/models/service';
import { htmlSafe } from '@ember/template';
import { escapeHtml } from 'ui/utils/util';

import { computed } from '@ember/object';

var ExternalService = Service.extend({
  type: 'externalService',

  healthState: computed(function() {
    return 'healthy';
  }),

  displayDetail: computed('hostname', 'externalIpAddresses.[]', function() {
    var out = '';
    if ( this.get('hostname') )
    {
      out = escapeHtml(this.get('hostname'));
    }
    else
    {
      var ips = this.get('externalIpAddresses') || [];
      var num = ips.get('length');
      for ( var i = 0 ; i < 3 && i < num ; i++ )
      {
        out += '<span>'+ (i === 0 ? '' : ', ') + escapeHtml(ips.objectAt(i)) + '</span>';
      }

      if ( num > 3 )
      {
        out += ' and ' + (num-3) + ' more';
      }
    }

    if ( out ) {
      return htmlSafe('<span class="text-muted">To: </span>' + out);
    }
  }),
});

export default ExternalService;
