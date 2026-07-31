import { resolve } from 'rsvp';
import { alias } from '@ember/object/computed';
import Service, { service } from '@ember/service';
import C from 'ui/utils/constants';
import { ajaxPromise } from 'ember-api-store/utils/ajax-promise';
import { loadScript } from 'ui/utils/load-script';

import { on } from '@ember/object/evented';

const RTL_LANGUAGES = ['fa-ir'];
const MOMENT_LOCALES = {
  'de-de': 'de',
  'fa-ir': 'fa',
  'fil-ph': 'tl-ph',
  'fr-fr': 'fr',
  'hu-hu': 'hu',
  'ja-jp': 'ja',
  'ko-kr': 'ko',
  'pt-br': 'pt-br',
  'ru-ru': 'ru',
  'uk-ua': 'uk',
  'zh-hans': 'zh-cn',
  'zh-tw': 'zh-tw',
};

export default Service.extend({
  prefs         : service(),
  session       : service(),
  intl          : service(),
  locales       : alias('app.locales'),
  growl         : service(),
  cookies       : service(),
  userTheme     : service('user-theme'),
  loadedLocales : null,

  bootstrap: on('init', function() {
    this.set('loadedLocales', []);
  }),

  initUnauthed() {
    let lang = C.LANGUAGE.DEFAULT;
    const fromSession = this.get(`session.${C.SESSION.LANGUAGE}`);
    const fromCookie  = this.get('cookies').get(C.COOKIE.LANG);

    if (fromSession) {
      lang = fromSession;
    } else if(fromCookie){
      lang = fromCookie;
    }

    return this.sideLoadLanguage(lang);
  },

  initLanguage(save=false) {
    let lang          = C.LANGUAGE.DEFAULT;
    const session     = this.get('session');

    const fromLogin   = session.get(C.SESSION.LOGIN_LANGUAGE);
    const fromPrefs   = this.get(`prefs.${C.PREFS.LANGUAGE}`); // get language from user prefs
    const fromSession = session.get(C.SESSION.LANGUAGE); // get local language
    const fromCookie  = this.get('cookies').get(C.COOKIE.LANG);// get language from cookie 


    if ( fromLogin ) {
      lang = fromLogin;
      if ( save ) {
        session.set(C.SESSION.LOGIN_LANGUAGE, undefined);
      }
    } else if ( fromPrefs ) {
      lang = fromPrefs;
    } else if (fromSession) {
      lang = fromSession;
    } else if (fromCookie) {
      lang = fromCookie;
    }

    lang = this.normalizeLang(lang);

    this.setLanguage(lang, save);
    return this.sideLoadLanguage(lang);
  },

  normalizeLang(lang) {
    return lang.toLowerCase();
  },

  getLocale() {
    return this.get('intl._locale')[0];
  },

  setLanguage(lang, savePref=true) {
    let session = this.get('session');
    lang = lang || session.get(C.SESSION.LANGUAGE);

    this.setMomentLocale(lang);
    this.setDocumentLanguage(lang);
    session.set(C.SESSION.LANGUAGE, lang);
    if ( savePref && session.get(C.SESSION.ACCOUNT_ID) ) {
      return this.set(`prefs.${C.PREFS.LANGUAGE}`, lang);
    } else {
      return resolve();
    }
  },

  setMomentLocale(lang) {
    const normalized = this.normalizeLang(lang || C.LANGUAGE.DEFAULT);
    moment.locale(MOMENT_LOCALES[normalized] || 'en');
  },

  setDocumentLanguage(lang) {
    const normalized = this.normalizeLang(lang || C.LANGUAGE.DEFAULT);

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', normalized);
      document.documentElement.setAttribute('dir', this.isRtl(normalized) ? 'rtl' : 'ltr');
    }
  },

  sideLoadLanguage(language) {
    let baseLanguage = C.LANGUAGE.DEFAULT;
    let loadBase = language !== 'none' && language !== baseLanguage;
    let promise = loadBase ? this.loadLanguageFile(baseLanguage) : resolve();

    return promise.then(() => {
      return this.loadLanguageFile(language);
    }).then(() => {
      let locales = loadBase ? [language, baseLanguage] : language;
      this.get('intl').setLocale(locales);
      this.setLanguage(language, false);
      this.get('userTheme').writeStyleNode();
    }).catch((err) => {
      this.get('growl').fromError('Error loading language: ' + language, err);
      if ( language !== baseLanguage ) {
        return this.sideLoadLanguage(baseLanguage);
      }
    });
  },

  loadLanguageFile(language) {
    let application = this.get('app');
    let loadedLocales = this.get('loadedLocales');

    if ( loadedLocales.includes(language) ) {
      return resolve();
    }

    return ajaxPromise({
      url: `${this.get('app.baseAssets')}translations/${language}.json?${application.version}`,
      method: 'GET',
      dataType: 'json',
    }).then((resp) => {
      let polyfillPromise;
      if ( this.get('app.needIntlPolyfill') ) {
        polyfillPromise = loadScript(`${this.get('app.baseAssets')}assets/intl/locales/${language.toLowerCase()}.js?${application.version}`);
      } else {
        polyfillPromise = resolve();
      }

      return polyfillPromise.then(() => {
        return this.get('intl').addTranslations(language, resp.xhr.responseJSON);
      }).then(() => {
        if ( !loadedLocales.includes(language) ) {
          loadedLocales.push(language);
        }
      });
    });
  },

  getAvailableTranslations() {
    return this.get('intl').getLocalesByTranslations();
  },

  isRtl(lang) {
    return RTL_LANGUAGES.includes(lang.toLowerCase());
  },

});
