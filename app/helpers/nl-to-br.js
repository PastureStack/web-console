import { helper as buildHelper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';
import { escapeHtml } from 'ui/utils/util';

export function nlToBr(params) {
  var val = escapeHtml(params[0]||'');
  return htmlSafe(val.replace(/\n/g,'<br/>\n'));
}

export default buildHelper(nlToBr);
