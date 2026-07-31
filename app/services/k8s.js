import { resolve } from 'rsvp';
import Service, { service } from '@ember/service';
import ApiError from 'ember-api-store/models/error';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Service.extend({
  'tab-session': service(),
  store: service('store'),

  kubernetesEndpoint: computed(
    `tab-session.${C.TABSESSION.PROJECT}`,
    'app.kubernetesEndpoint',
    function() {
      return this.get('app.kubernetesEndpoint').replace(this.get('app.projectToken'), this.get(`tab-session.${C.TABSESSION.PROJECT}`));
    }
  ),

  kubectlEndpoint: computed(`tab-session.${C.TABSESSION.PROJECT}`, 'app.kubectlEndpoint', function() {
    return this.get('app.kubectlEndpoint').replace(this.get('app.projectToken'), this.get(`tab-session.${C.TABSESSION.PROJECT}`));
  }),

  kubernetesDashboard: computed(
    `tab-session.${C.TABSESSION.PROJECT}`,
    'app.kubernetesDashboard',
    function() {
      return this.get('app.kubernetesDashboard').replace(this.get('app.projectToken'), this.get(`tab-session.${C.TABSESSION.PROJECT}`));
    }
  ),

  supportsAuth: computed('version.{minor,major}', function() {
    let v = this.get('version');
    if ( v && v['major'] )
    {
      let major = parseInt(v['major'],10);
      let minor = parseInt(v['minor'],10);
      return (major > 1) || (major === 1 && minor >= 6);
    }
  }),

  isReady() {
    let store = this.get('store');
    return store.find('stack').then((stacks) => {
      let stack = this.filterSystemStack(stacks);
      if ( stack )
      {
        return store.rawRequest({
          url: `${this.get('kubernetesEndpoint')}/version`
        }).then((res) => {
          this.set('version', res.body);
          return true;
        }).catch(() => {
          return false;
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
        info.name === C.EXTERNAL_ID.KIND_KUBERNETES;
    });
  },

  parseKubectlError(err) {
    return ApiError.create({
      status: err.status,
      code: err.body.exitCode,
      message: err.body.stdErr.split(/\n/),
    });
  },
});
