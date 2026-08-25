import { get } from '@ember/object';
import { makeArray } from '@ember/array';
import missingMessage from 'ui/utils/intl/missing-message';

export function initialize(instance) {
  var intl = instance.lookup('service:intl');

  // Keep the narrow legacy call surface while the application moves to the
  // public Ember Intl 8 API. New code should call t(), exists(), locales, and
  // formatMessage() directly.
  intl.findTranslationByKey = function(key, locales) {
    locales = makeArray(locales || get(this, '_locale'));
    key = key || 'generic.missing';

    if (locales[0] === 'none') {
      return missingMessage(key, locales);
    }

    for (let locale of locales) {
      let translation = this.getTranslation(key, locale);
      if (translation !== undefined) {
        return translation;
      }
    }

    return missingMessage(key, locales);
  };

  intl.formatHtmlMessage = function(message, options) {
    return this.formatMessage(message, Object.assign({}, options, {htmlSafe: true}));
  };

  intl.tHtml = function(key, options) {
    return this.t(key, Object.assign({}, options, {htmlSafe: true}));
  };

  intl.getLocalesByTranslations = function() {
    return this.locales.slice();
  };
}

export default {
  name: 'intl-compatibility',
  initialize: initialize
};
