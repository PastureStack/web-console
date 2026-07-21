import Ember from 'ember';
import { formatDateTime, isTraditionalChinese } from 'ui/utils/date-time';

export function dateCalendar(params) {
  let date = moment(params[0]);
  let now = moment();
  let diff = now.diff(date);
  if ( Math.abs(diff) > 44*60*1000 ) {
    if ( isTraditionalChinese() ) {
      return formatDateTime(params[0]);
    }

    return date.calendar();
  } else if ( diff > 0 ) {
    return date.fromNow();
  } else {
    return date.toNow();
  }
}

export default Ember.Helper.helper(dateCalendar);
