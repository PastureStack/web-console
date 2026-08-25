import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import SelectTabComponent from 'ui/components/select-tab/component';
import inertRenderer from '../../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

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
  destroyOwned(component);
}

module('Integration | Component | select tab');

test('it keeps the component defaults', function(assert) {
  var calls = [];
  var component;

  run(() => {
    component = createOwned(SelectTabComponent, {
      renderer: inertRenderer(),
      $: fakeDollar(calls),
    }, 'component');
  });

  assert.equal(component.get('tagName'), 'section');
  assert.equal(component.get('initialTab'), '');
  destroy(component);
});

test('it selects the configured initial tab after render', function(assert) {
  var calls = [];
  var component;

  run(() => {
    component = createOwned(SelectTabComponent, {
      renderer: inertRenderer(),
      initialTab: 'network',
      $: fakeDollar(calls),
    }, 'component');
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

  run(() => {
    component = createOwned(SelectTabComponent, {
      renderer: inertRenderer(),
      $: fakeDollar(calls),
    }, 'component');
  });
  calls.length = 0;

  run(() => component.send('selectTab', 'advanced'));

  assert.equal(component.get('tab'), 'advanced');
  assert.deepEqual(calls, [
    '.tab:removeClass:active',
    '.tab[data-section="advanced"]:addClass:active',
    '.section:addClass:hide',
    '.section[data-section="advanced"]:removeClass:hide',
  ]);
  destroy(component);
});
