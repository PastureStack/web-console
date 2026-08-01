import { module, test } from 'qunit';

import Ember from 'ember';

module('Unit | Vendor | Legacy component action');

test('it sends named classic component actions to their target', function(assert) {
  assert.expect(3);

  let component = {
    _target: {
      send(name, code) {
        assert.equal(name, 'authenticate', 'uses the configured action name');
        assert.equal(code, 'operator:secret', 'forwards the action arguments');

        return 'sent';
      }
    },
    get(key) {
      if (key === 'action') {
        return 'authenticate';
      }
    }
  };

  assert.equal(
    Ember.Component.prototype.sendAction.call(component, 'action', 'operator:secret'),
    'sent',
    'returns the target action result'
  );
});

test('it invokes closure actions and ignores missing actions', function(assert) {
  assert.expect(3);

  let closureComponent = {
    get(key) {
      if (key === 'save') {
        return function(value) {
          assert.strictEqual(this, closureComponent, 'uses the component as the closure context');
          assert.equal(value, 42, 'forwards closure arguments');

          return 'closed';
        };
      }
    }
  };

  assert.equal(
    Ember.Component.prototype.sendAction.call(closureComponent, 'save', 42),
    'closed',
    'returns the closure result'
  );
  Ember.Component.prototype.sendAction.call({get() {}}, 'missing');
});

test('it does not recursively invoke a component prototype event method', function(assert) {
  assert.expect(1);

  let prototype = {
    input() {
      assert.ok(false, 'must not re-enter the native input event handler');
    }
  };
  let component = Object.create(prototype);

  component.get = function(key) {
    return this[key];
  };

  Ember.Component.prototype.sendAction.call(component, 'input', 'value');
  assert.ok(true, 'prototype event methods are ignored when no closure action was supplied');
});
