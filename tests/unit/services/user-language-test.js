import { resolve } from 'rsvp';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

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
  run(() => service.destroy());
});

test('it loads English as a fallback before a selected translation', function(assert) {
  let done = assert.async();
  let loaded = [];
  let selectedLocales;
  let service = UserLanguageService.create({
    intl: EmberObject.create({
      setLocale(locales) {
        selectedLocales = locales;
      },
    }),
    userTheme: EmberObject.create({
      writeStyleNode() {},
    }),
  });

  service.loadLanguageFile = function(language) {
    loaded.push(language);
    return resolve();
  };
  service.setLanguage = function() {
    return resolve();
  };

  service.sideLoadLanguage('zh-tw').then(() => {
    assert.deepEqual(loaded, ['en-us', 'zh-tw']);
    assert.deepEqual(selectedLocales, ['zh-tw', 'en-us']);
  }).finally(() => {
    run(() => service.destroy());
    done();
  });
});
