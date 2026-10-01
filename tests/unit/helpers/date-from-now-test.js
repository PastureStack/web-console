import { module, test } from 'qunit';

import {
  dateFromNow
} from 'ui/helpers/date-from-now';
import { momentLocale } from 'ui/services/user-language';

module('Unit | Helper | date from now');

test('the shared Moment locale resolver preserves every existing language mapping', function(assert) {
  let languages = ['de-de', 'fa-ir', 'fil-ph', 'fr-fr', 'hu-hu', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'uk-ua', 'zh-hans', 'zh-tw', 'en-us'];
  let locales = ['de', 'fa', 'tl-ph', 'fr', 'hu', 'ja', 'ko', 'pt-br', 'ru', 'uk', 'zh-cn', 'zh-tw', 'en'];

  assert.deepEqual(languages.map((language) => momentLocale(language)), locales);
  assert.strictEqual(momentLocale(), 'en', 'the default language is unchanged');
});

test('an explicit locale is instance-local and uses the existing language mapping', function(assert) {
  let previousLocale = moment.locale();
  let previousNow = moment.now;

  try {
    moment.locale('en');
    moment.now = () => Date.UTC(2026, 9, 1, 12);
    let date = [Date.UTC(2026, 9, 1, 8)];

    assert.strictEqual(dateFromNow(date, 'zh-TW'), '4 小時前');
    assert.strictEqual(dateFromNow(date, 'zh-hans'), '4 小时前');
    assert.strictEqual(dateFromNow(date, 'en-us'), '4 hours ago');
    assert.strictEqual(dateFromNow(date, 'unknown-locale'), '4 hours ago', 'unknown languages retain the existing English fallback');
    assert.strictEqual(moment.locale(), 'en', 'formatting does not mutate the global Moment locale');
  } finally {
    moment.now = previousNow;
    moment.locale(previousLocale);
  }
});

test('the named helper function keeps the original global-locale behavior when no locale is supplied', function(assert) {
  let previousLocale = moment.locale();
  let previousNow = moment.now;

  try {
    moment.locale('zh-tw');
    moment.now = () => Date.UTC(2026, 9, 1, 12);
    assert.strictEqual(dateFromNow([Date.UTC(2026, 9, 1, 8)]), '4 小時前');
  } finally {
    moment.now = previousNow;
    moment.locale(previousLocale);
  }
});
