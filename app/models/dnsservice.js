import { service } from '@ember/service';
import Service from 'ui/models/service';
import { computed } from '@ember/object';
import { htmlSafe } from '@ember/template';
import { escapeHtml } from 'ui/utils/util';

var DnsService = Service.extend({
  type: 'dnsService',
  intl: service(),

  healthState: 'healthy',

  displayDetail: computed(
    'consumedServicesWithNames.@each.{name,service}',
    'intl._locale',
    function() {
      let intl = this.get('intl');
      let toTranslation = intl.tHtml('generic.to');
      let noneTranslation = intl.tHtml('generic.none');

      var services = '';
      (this.get('consumedServicesWithNames')||[]).forEach((map, idx) => {
        services += '<span>'+ (idx === 0 ? '' : ', ') +
        (map.get('service.stackId') === this.get('stackId') ? '' : escapeHtml(map.get('service.displayStack')) + '/') +
        escapeHtml(map.get('service.displayName')) + '</span>';
      });

      var out = '<label>'+ toTranslation +': </label>' + services || '<span class="text-muted">'+ noneTranslation +'</span>';

      return htmlSafe(out);
    }
  ),
});

export default DnsService;
