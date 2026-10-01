import Helper from '@ember/component/helper';
import { observer } from '@ember/object';
import { service } from '@ember/service';
import { momentLocale } from 'ui/services/user-language';

export function dateFromNow(params, locale) {
  let date = moment(params[0]);

  if ( locale ) {
    date.locale(momentLocale(locale));
  }

  return date.fromNow();
}

export default Helper.extend({
  intl: service(),

  localeChanged: observer('intl._locale', function() {
    this.recompute();
  }),

  compute(params) {
    return dateFromNow(params, this.get('intl.primaryLocale'));
  },
});
