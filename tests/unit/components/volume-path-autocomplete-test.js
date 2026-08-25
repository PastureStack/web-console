import { A } from '@ember/array';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import VolumePathAutocomplete from 'ui/components/volume-path-autocomplete/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | volume path autocomplete');

function keyboardEvent(key) {
  return {
    key,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

test('arrow keys select and Enter completes without routing through sendAction', function(assert) {
  assert.expect(7);
  let changed;
  let component;

  run(() => {
    component = createOwned(VolumePathAutocomplete, {
      renderer: inertRenderer(),
      value: 'da',
      suggestions: A([
        {value: 'data1:/data', source: 'existing'},
        {value: 'data2:/data', source: 'existing'},
      ]),
      changed(value) {
        changed = value;
      },
      sendAction() {
        assert.ok(false, 'closure callback is used directly');
      },
    }, 'component');
    component.set('isOpen', true);
  });

  assert.equal(component.get('visibleSuggestions.length'), 2);
  assert.equal(component.get('inlineCompletion.suffix'), 'ta1:/data');

  let down = keyboardEvent('ArrowDown');
  component.send('keyDown', down);
  assert.ok(down.prevented, 'arrow navigation does not move the caret');
  assert.equal(component.get('activeIndex'), 1);

  let enter = keyboardEvent('Enter');
  component.send('keyDown', enter);
  assert.ok(enter.prevented, 'completion consumes Enter');
  assert.equal(changed, 'data2:/data');
  assert.notOk(component.get('isOpen'), 'closes after completion');

  destroyOwned(component);
});

test('Escape closes the candidate list without changing the value', function(assert) {
  let changed = false;
  let component = createOwned(VolumePathAutocomplete, {
    renderer: inertRenderer(),
    value: '/d',
    suggestions: A(['/data']),
    changed() {
      changed = true;
    },
  }, 'component');

  run(() => component.set('isOpen', true));
  let escape = keyboardEvent('Escape');
  component.send('keyDown', escape);

  assert.notOk(component.get('isOpen'));
  assert.notOk(changed);
  assert.ok(escape.prevented);
  destroyOwned(component);
});

test('Tab completes the active candidate and preserves normal focus movement', function(assert) {
  let changed;
  let component = createOwned(VolumePathAutocomplete, {
    renderer: inertRenderer(),
    value: '/da',
    suggestions: A(['/data']),
    changed(value) {
      changed = value;
    },
  }, 'component');

  run(() => component.set('isOpen', true));
  let tab = keyboardEvent('Tab');
  component.send('keyDown', tab);

  assert.equal(changed, '/data');
  assert.notOk(tab.prevented, 'the browser can move focus after completion');
  assert.notOk(component.get('isOpen'));
  destroyOwned(component);
});

test('mouse selection accepts the highlighted candidate', function(assert) {
  let changed;
  let prevented = false;
  let component = createOwned(VolumePathAutocomplete, {
    renderer: inertRenderer(),
    value: 'sha',
    suggestions: A([{value: 'shared:/srv/shared', source: 'existing'}]),
    changed(value) {
      changed = value;
    },
  }, 'component');

  run(() => component.set('isOpen', true));
  component.send('chooseSuggestion', component.get('activeSuggestion'), {
    preventDefault() {
      prevented = true;
    },
  });

  assert.ok(prevented, 'keeps the input focused during mouse selection');
  assert.equal(changed, 'shared:/srv/shared');
  assert.notOk(component.get('isOpen'));
  destroyOwned(component);
});
