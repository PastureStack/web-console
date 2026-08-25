import { service } from '@ember/service';
import Helper from '@ember/component/helper';

export function formatHtmlMessage(intl, params, namedOptions) {
  let key = params[0] || 'generic.missing';
  let positionalOptions = params[1];
  let options = positionalOptions ? Object.assign({}, positionalOptions, namedOptions) : Object.assign({}, namedOptions);

  options.htmlSafe = true;

  return intl.t(key, options);
}

export default Helper.extend({
  intl: service(),

  compute(params, namedOptions) {
    return formatHtmlMessage(this.get('intl'), params, namedOptions);
  }
});
