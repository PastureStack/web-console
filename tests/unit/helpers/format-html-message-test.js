import { module, test } from 'qunit';

import {
  formatHtmlMessage
} from 'ui/helpers/format-html-message';

module('Unit | Helper | format html message');

test('it restores the legacy HTML-safe translation helper contract', function(assert) {
  assert.expect(3);

  let intl = {
    t(key, options) {
      assert.equal(key, 'loginPage.greeting', 'passes the translation key to Ember Intl');
      assert.deepEqual(options, {
        appName: 'PastureStack',
        htmlSafe: true
      }, 'preserves interpolation values and explicitly requests an HTML-safe result');

      return 'Welcome to PastureStack';
    }
  };

  assert.equal(
    formatHtmlMessage(intl, ['loginPage.greeting'], {appName: 'PastureStack'}),
    'Welcome to PastureStack',
    'returns the formatted translation'
  );
});
