import { makeArray } from '@ember/array';
import missingMessage from 'ui/utils/intl/missing-message';
import C from 'ui/utils/constants';

export function initialize(instance) {
  var intl = instance.lookup('service:intl');

  // ember-intl 7 no longer seeds a default locale.  Templates can render
  // while the language JSON is still loading, so establish a safe locale
  // before the first translation lookup.
  intl.setLocale(C.LANGUAGE.DEFAULT);
  intl.setOnMissingTranslation(missingMessage);
  intl.reopen({
    findTranslationByKey(key, locales) {
      locales = makeArray(locales || this._locale || this.primaryLocale || 'unknown');

      if (locales[0] === 'none') {
        return missingMessage(key, locales);
      }

      key = key || 'generic.missing';
      for (let locale of locales) {
        let translation = this.getTranslation(key, locale);
        if (translation !== undefined) {
          return translation;
        }
      }

      return missingMessage(key, locales);
    },

    formatHtmlMessage(message, options = {}) {
      return this.formatMessage(message, {
        ...options,
        htmlSafe: true,
      });
    },

    tHtml(key, options = {}) {
      const translation = this.findTranslationByKey(key, options.locale);
      return this.formatHtmlMessage(translation, options);
    }
  });
}

export default {
  name: 'intl',
  initialize: initialize
};
