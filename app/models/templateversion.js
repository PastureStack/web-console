import { service } from '@ember/service';
import Resource from 'ember-api-store/models/resource';
import C from 'ui/utils/constants';

import { computed } from '@ember/object';

export default Resource.extend({
  projects: service(),

  headers: computed('project.current.id', function() {
    return {
      [C.HEADER.PROJECT_ID]: this.get('projects.current.id')
    };
  }),

  filesAsArray: computed('files', function() {
    var obj = (this.get('files')||{});
    var out = [];

    Object.keys(obj).forEach((key) => {
      out.push({name: key, body: obj[key]});
    });

    return out;
  }),

  supportsOrchestration(orch) {
    orch = orch.replace(/.*\*/,'');
    if ( orch === 'k8s' ) {
      orch = 'kubernetes';
    }
    let list = ((this.get('labels')||{})[C.LABEL.ORCHESTRATION_SUPPORTED]||'').split(/\s*,\s*/).filter((x) => x.length > 0);
    if ( orch === 'windows' ) {
      return list.includes(orch);
    }
    return list.length === 0 || list.includes(orch);
  },
});
