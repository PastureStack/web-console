import { service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  access: service(),

  model: function() {
    var route = (this.get('access.provider')||'').toLowerCase().replace(/config$/i,'');
    if ( route === 'ldap' )
    {
      route = 'activedirectory';
    }

    if ( this.get('access.enabled') )
    {
      this.get('router').replaceWith('admin-tab.auth.' + route);
    }
    else
    {
      this.get('router').replaceWith('admin-tab.auth.github');
    }
  },
});
