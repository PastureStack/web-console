import { helper as buildHelper } from '@ember/component/helper';
import { formatDateTime } from 'ui/utils/date-time';

export function dateStr(params, options) {
  let format = options && options.format;

  return formatDateTime(params[0], format);
}

export default buildHelper(dateStr);
