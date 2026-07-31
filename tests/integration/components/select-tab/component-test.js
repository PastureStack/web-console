import Ember from 'ember';
import { module, test } from 'qunit';

import SelectTabComponent from 'ui/components/select-tab/component';

function fakeDollar(calls) {
  return function(selector) {
    return {
      addClass(name) {
        calls.push(`${selector}:addClass:${name}`);
        return this;
      },

      removeClass(name) {
        calls.push(`${selector}:removeClass:${name}`);
        return this;
      },
    };
  };
}

function destroy(component) {
  Ember.run(() => component.destroy());
}

module('Integration | Component | select tab');

test('it keeps the component defaults', function(assert) {
  var calls = [];
  var component;

  Ember.run(() => {
    component = SelectTabComponent.create({
      $: fakeDollar(calls),
    });
  });

  assert.equal(component.get('tagName'), 'section');
  assert.equal(component.get('initialTab'), '');
  destroy(component);
});

test('it selects the configured initial tab after render', function(assert) {
  var calls = [];
  var component;

  Ember.run(() => {
    component = SelectTabComponent.create({
      initialTab: 'network',
      $: fakeDollar(calls),
    });
  });

  assert.equal(component.get('tab'), 'network');
  assert.deepEqual(calls, [
    '.tab:removeClass:active',
    '.tab[data-section="network"]:addClass:active',
    '.section:addClass:hide',
    '.section[data-section="network"]:removeClass:hide',
  ]);
  destroy(component);
});

test('selectTab updates active tab and section classes', function(assert) {
  var calls = [];
  var component;

  Ember.run(() => {
    component = SelectTabComponent.create({
      $: fakeDollar(calls),
    });
  });
  calls.length = 0;

  Ember.run(() => component.send('selectTab', 'advanced'));

  assert.equal(component.get('tab'), 'advanced');
  assert.deepEqual(calls, [
    '.tab:removeClass:active',
    '.tab[data-section="advanced"]:addClass:active',
    '.section:addClass:hide',
    '.section[data-section="advanced"]:removeClass:hide',
  ]);
  destroy(component);
});
