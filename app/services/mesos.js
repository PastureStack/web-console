import { reject, resolve } from 'rsvp';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';

export default Service.extend({
  'tab-session': service('tab-session'),
  store: service(),

  publicUrl: function() {
    return this.get('store').find('service').then((services) => {
      let master = services.filterBy('name', C.MESOS.MASTER_SERVICE)[0];
      if ( master )
      {
        let ips = master.get('endpointsMap')[C.MESOS.MASTER_PORT];
        if ( ips && ips.length ) {
          return 'http://' + ips[0] + ':' + C.MESOS.MASTER_PORT;
        }
      }

      return reject('No mesos-master endpoint found');
    });
  },

  masterUrl: function() {
    let projectId = this.get(`tab-session.${C.TABSESSION.PROJECT}`);
    return this.get('app.mesosEndpoint').replace('%PROJECTID%', projectId);
  }.property('app.mesosEndpoint',`tab-session.${C.TABSESSION.PROJECT}`),

  isReady: function() {
    return this.get('store').find('stack').then((stacks) => {
      let stack = this.filterSystemStack(stacks);
      if ( stack )
      {
        return this.get('store').rawRequest({
          url: `${this.get('masterUrl')}/${C.MESOS.HEALTH}`
        }).then(() => {
          return true;
        }).catch(() => {
          return resolve(false);
        });
      }

      return false;
    }).catch(() => {
      return resolve(false);
    });
  },

  filterSystemStack(stacks) {
    return (stacks||[]).find((stack) => {
      let info = stack.get('externalIdInfo');
      return (info.kind === C.EXTERNAL_ID.KIND_CATALOG || info.kind === C.EXTERNAL_ID.KIND_SYSTEM_CATALOG) &&
        info.base === C.EXTERNAL_ID.KIND_INFRA &&
        info.name === C.EXTERNAL_ID.KIND_MESOS;
    });
  },
});
