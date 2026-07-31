import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import { initialize } from 'ui/instance-initializers/intl';

module('Unit | Instance Initializer | intl');

test('it establishes the default locale before templates translate', function(assert) {
  let selectedLocale;
  let missingTranslationHandler;
  let intl = EmberObject.create({
    setLocale(locale) {
      selectedLocale = locale;
    },
    setOnMissingTranslation(handler) {
      missingTranslationHandler = handler;
    },
  });

  initialize({
    lookup(name) {
      assert.equal(name, 'service:intl');
      return intl;
    },
  });

  assert.equal(selectedLocale, 'en-us');
  assert.equal(typeof missingTranslationHandler, 'function');
  assert.equal(typeof intl.findTranslationByKey, 'function');
  assert.equal(typeof intl.formatHtmlMessage, 'function');
  assert.equal(typeof intl.tHtml, 'function');

  run(() => intl.destroy());
});
