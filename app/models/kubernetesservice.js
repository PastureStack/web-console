import { alias } from '@ember/object/computed';
import Service from 'ui/models/service';
import { htmlSafe } from '@ember/template';
import { escapeHtml } from 'ui/utils/util';

import { computed } from '@ember/object';

var KubernetesService = Service.extend({
  type: 'kubernetesService',
  spec: alias('template.spec'),

  displayPorts: computed('spec.ports.[]', function() {
    var pub = '';
    (this.get('spec.ports')||[]).forEach((port, idx) => {
      pub += '<span>' + (idx === 0 ? '' : ', ') +
        escapeHtml(port.port) +
        '</span>';
    });

    var out =  '<label>Ports: </label>' + (pub||'<span class="text-muted">None</span>');

    return htmlSafe(out);
  }),
});

export default KubernetesService;
