import Ember from 'ember';
import { htmlSafe } from '@ember/template';
import escapeHtml from 'ui/utils/escape-html';

export function nlToBr(params) {
  var val = escapeHtml(params[0] || '');
  return htmlSafe(val.replace(/\n/g,'<br/>\n'));
}

export default Ember.Helper.helper(nlToBr);
