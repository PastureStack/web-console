import Ember from 'ember';

export function formatHtmlMessage(intl, params, namedOptions) {
  let key = params[0] || 'generic.missing';
  let positionalOptions = params[1];
  let options = positionalOptions ? Object.assign({}, positionalOptions, namedOptions) : Object.assign({}, namedOptions);

  options.htmlSafe = true;

  return intl.t(key, options);
}

export default Ember.Helper.extend({
  intl: Ember.inject.service(),

  compute(params, namedOptions) {
    return formatHtmlMessage(this.get('intl'), params, namedOptions);
  }
});
