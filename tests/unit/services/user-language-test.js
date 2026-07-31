import { module, test } from 'qunit';

import Ember from 'ember';
import UserLanguageService from 'ui/services/user-language';

module('Unit | Service | user language');

test('it synchronizes the document language and writing direction', function(assert) {
  let service = UserLanguageService.create();
  let root = document.documentElement;
  let previousLang = root.getAttribute('lang');
  let previousDir = root.getAttribute('dir');

  service.setDocumentLanguage('zh-TW');
  assert.equal(root.getAttribute('lang'), 'zh-tw');
  assert.equal(root.getAttribute('dir'), 'ltr');

  service.setDocumentLanguage('fa-IR');
  assert.equal(root.getAttribute('lang'), 'fa-ir');
  assert.equal(root.getAttribute('dir'), 'rtl');

  if (previousLang === null) {
    root.removeAttribute('lang');
  } else {
    root.setAttribute('lang', previousLang);
  }
  if (previousDir === null) {
    root.removeAttribute('dir');
  } else {
    root.setAttribute('dir', previousDir);
  }
  Ember.run(() => service.destroy());
});

test('it loads English as a fallback before a selected translation', function(assert) {
  let done = assert.async();
  let loaded = [];
  let selectedLocales;
  let service = UserLanguageService.create({
    intl: Ember.Object.create({
      setLocale(locales) {
        selectedLocales = locales;
      },
    }),
    userTheme: Ember.Object.create({
      writeStyleNode() {},
    }),
  });

  service.loadLanguageFile = function(language) {
    loaded.push(language);
    return Ember.RSVP.resolve();
  };
  service.setLanguage = function() {
    return Ember.RSVP.resolve();
  };

  service.sideLoadLanguage('zh-tw').then(() => {
    assert.deepEqual(loaded, ['en-us', 'zh-tw']);
    assert.deepEqual(selectedLocales, ['zh-tw', 'en-us']);
  }).finally(() => {
    Ember.run(() => service.destroy());
    done();
  });
});
