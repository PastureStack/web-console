import { helper as buildHelper } from '@ember/component/helper';
import {
  formatDateTime,
  isTraditionalChinese
} from 'ui/utils/date-time';

export function dateCalendar(params, options) {
  if ( isTraditionalChinese() ) {
    return formatDateTime(params[0]);
  }

  let out = moment(params[0]).calendar();
  if ( options && options.withToday !== true  ) {
    out = out.replace('Today at ','');
  }

  return out;
}

export default buildHelper(dateCalendar);
