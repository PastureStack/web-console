import Service from 'ui/models/service';
import Ember from 'ember';
import escapeHtml from 'ui/utils/escape-html';

const esc = escapeHtml;

var KubernetesService = Service.extend({
  type: 'kubernetesService',
  spec: Ember.computed.alias('template.spec'),

  displayPorts: function() {
    var pub = '';
    (this.get('spec.ports')||[]).forEach((port, idx) => {
      pub += '<span>' + (idx === 0 ? '' : ', ') +
        esc(port.port) +
        '</span>';
    });

    var out =  '<label>Ports: </label>' + (pub||'<span class="text-muted">None</span>');

    return out.htmlSafe();
  }.property('spec.ports.[]'),
});

export default KubernetesService;
