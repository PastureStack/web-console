import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Service.extend({
  cookies: service(),
  'tab-session': service('tab-session'),
  settings: service(),

  absolute: computed('app.apiServer', function() {
    var url = this.get('app.apiServer');

    // If the URL is relative, add on the current base URL from the browser
    if ( url.indexOf('http') !== 0 )
    {
      url = window.location.origin + '/' + url.replace(/^\/+/,'');
    } 

    // URL must end in a single slash
    url = url.replace(/\/+$/,'') + '/';

    return url;
  }),

  host: computed('absolute', function() {
    var a = document.createElement('a');
    a.href = this.get('absolute');
    return a.host;
  }),

  origin: computed('absolute', function() {
    var a = document.createElement('a');
    a.href = this.get('absolute');
    return a.origin;
  }),

  swarm: computed(`settings.${C.SETTING.SWARM_PORT}`, function() {
    var port = this.get(`settings.${C.SETTING.SWARM_PORT}`);
    if ( !port ) {
      port = parseInt(window.location.port,10);
    }

    if ( !port ) {
      port = ( window.location.protocol === 'https:' ? 443 : 80 );
    }

    return `tcp://${window.location.hostname}:${port}`;
  })
});
