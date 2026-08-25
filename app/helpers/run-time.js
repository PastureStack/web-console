import { helper as buildHelper } from '@ember/component/helper';
import { formatDurationSeconds } from 'ui/utils/date-time';

export function runTime(params) {
  var s = moment(params[0]);
  var e = moment(params[1]);
  var time =  Math.round(e.diff(s)/100)/10;
  if ( time )
  {
    if ( time > 60 )
    {
      time = Math.round(time);
    }

    return formatDurationSeconds(time);
  }
  else
  {
    return '<span class="text-muted">-</span>'.htmlSafe();
  }
}

export default buildHelper(runTime);
