import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import C from 'ui/utils/constants';

export default Component.extend({
  // Set to true on login to savesession value instead of user-pref
  login        : false,

  tagName      : 'div',
  classNames   : ['dropdown', 'language-dropdown', 'inline-block'],
  classNameBindings: ['hideSingle:hide'],

  language     : service('user-language'),
  intl         : service(),
  session      : service(),
  settings     : service(),

  locales : alias('language.locales'),

  hideSingle: computed('locales', function() {
    return Object.keys(this.get('locales')).length <= 1;
  }),

  actions: {
    selectLanguage(language) {
      if (this.get('login')) {
        this.get('session').set(C.SESSION.LOGIN_LANGUAGE, language);
      }

      this.get('language').sideLoadLanguage(language).then(() => {
        if (!this.get('login')) {
          this.get('language').setLanguage(language);
        }
      });
    }
  },

  selected : computed('intl._locale', function() {
    let locale = this.get('intl._locale');
    if (locale) {
      return locale[0];
    }
    return null;
  }),

  selectedLabel: computed('selected','locales', function() {
    let sel = this.get('selected');
    let out = '';
    if (sel) {
      out = this.get('locales')[sel];
    }

    if (!out) {
      out = 'Language';
    }

    // Strip parens for display
    return out.replace(/\s+\(.+\)$/,'');
  }),

});
