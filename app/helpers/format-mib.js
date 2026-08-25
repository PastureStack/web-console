import { helper as buildHelper } from '@ember/component/helper';
import Util from 'ui/utils/util';

export function formatMib(params, options) {
  return Util.formatMib(params[0], options.adaptive);
}

export default buildHelper(formatMib);
