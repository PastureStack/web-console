import { service } from '@ember/service';
import Helper from '@ember/component/helper';
import { htmlSafe } from '@ember/template';
import { escapeHtml } from 'ui/utils/util';

export default Helper.extend({
  intl: service(),

  compute(params, options) {
    let noIp = options.noIp || 'formatIp.noIp';
    let ip = params[0];

    if ( ip === '0:0:0:0:0:0:0:1' ) {
      ip = '::1';
    }

    if ( ip ) {
      return ip;
    } else {
      return htmlSafe('<span class="text-muted">'+escapeHtml(this.get('intl').t(noIp))+'</span>');
    }
  }
});
