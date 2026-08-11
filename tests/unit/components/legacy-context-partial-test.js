import { module, test } from 'qunit';

import Ember from 'ember';
import LegacyContextPartial from 'ui/components/legacy-context-partial/component';
import {
  dispatchContextAction,
  readContextProperty,
  writeContextProperty
} from 'ui/components/legacy-context-partial/component';
import {
  LEGACY_CONTEXT_PARTIALS,
  registerLegacyContextPartials
} from 'ui/initializers/legacy-context-partials';
import { resolveTooltipContentComponent } from 'ui/utils/tooltip-content-component';

module('Unit | Component | legacy context partial');

test('it reads and writes the explicitly supplied rendering context', function(assert) {
  let context = Ember.Object.create({ value: 'before' });

  assert.equal(readContextProperty(context, 'value'), 'before', 'reads through the context');
  assert.equal(writeContextProperty(context, 'value', 'after'), 'after', 'returns the assigned value');
  assert.equal(context.get('value'), 'after', 'writes through to the context');
  assert.strictEqual(readContextProperty(null, 'value'), undefined, 'handles a missing context');
  assert.strictEqual(LegacyContextPartial.proto().parentView, null, 'keeps parent view lifecycle state on the component proxy target');
  assert.strictEqual(LegacyContextPartial.proto().elementId, null, 'keeps element identity lifecycle state on the component proxy target');
});

test('it forwards template actions only to a context that can receive them', function(assert) {
  let context = {
    send(name, value) {
      assert.equal(name, 'save', 'forwards the action name');
      assert.equal(value, 42, 'forwards action arguments');

      return 'saved';
    }
  };
  let result = dispatchContextAction(context, 'save', [42]);

  assert.true(result.handled, 'marks a forwarded action as handled');
  assert.equal(result.value, 'saved', 'returns the context action result');
  assert.deepEqual(dispatchContextAction({}, 'save', []), { handled: false }, 'fails closed without a receiver');
});

test('it registers a unique, explicitly templated component for every migrated partial', function(assert) {
  let entries = {};
  let registrations = [];
  let attachments = [];

  LEGACY_CONTEXT_PARTIALS.forEach((name) => {
    entries[`ui/components/${name}/template`] = true;
  });

  registerLegacyContextPartials(
    {
      register(name, ComponentClass) {
        registrations.push({ name, ComponentClass });
      }
    },
    entries,
    (name) => ({ default: `compiled:${name}` }),
    (template, ComponentClass) => attachments.push({ template, ComponentClass })
  );

  assert.equal(registrations.length, LEGACY_CONTEXT_PARTIALS.length, 'registers the complete reviewed inventory');
  assert.equal(attachments.length, LEGACY_CONTEXT_PARTIALS.length, 'attaches every compiled template');
  assert.equal(new Set(registrations.map((item) => item.ComponentClass)).size, LEGACY_CONTEXT_PARTIALS.length, 'uses a distinct component class per template');
  assert.equal(registrations[0].name, `component:${LEGACY_CONTEXT_PARTIALS[0]}`, 'registers under the public component namespace');
  assert.throws(
    () => registerLegacyContextPartials({}, {}, () => ({}), () => {}),
    /template is missing/,
    'fails closed when a reviewed template is absent'
  );
});

test('it resolves only the reviewed tooltip content component inventory', function(assert) {
  assert.equal(resolveTooltipContentComponent('tooltip-cpu'), 'tooltip-content-cpu');
  assert.equal(resolveTooltipContentComponent(), 'tooltip-content-basic');
  assert.equal(resolveTooltipContentComponent('unreviewed-template', 'tooltip-action-menu'), 'tooltip-content-action-menu');
});
