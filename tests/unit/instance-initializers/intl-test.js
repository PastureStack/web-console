import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { initialize } from 'ui/instance-initializers/intl';

module('Unit | Instance Initializer | intl compatibility');

test('keeps classic locale observers synchronized with Ember Intl 9', function(assert) {
  let notified = [];
  let intl = EmberObject.create({
    _locales: undefined,
    locales: [],
    setLocale(locales) {
      this.set('_locales', Array.isArray(locales) ? locales : [locales]);
    },
  });
  let notifyPropertyChange = intl.notifyPropertyChange.bind(intl);

  intl.notifyPropertyChange = function(key) {
    notified.push(key);
    return notifyPropertyChange(key);
  };

  initialize({
    lookup() {
      return intl;
    },
  });

  assert.deepEqual(intl.get('_locale'), [], 'locale reads are safe before language bootstrap');

  intl.setLocale(['zh-tw', 'en-us']);

  assert.deepEqual(intl.get('_locale'), ['zh-tw', 'en-us'], 'the active locale order is preserved');
  assert.ok(notified.includes('_locale'), 'classic locale-dependent properties are invalidated');
});
