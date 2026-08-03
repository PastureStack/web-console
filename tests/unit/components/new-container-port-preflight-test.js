import Ember from 'ember';
import { module, test } from 'qunit';

import NewContainerComponent from 'ui/components/new-container/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new container port preflight');

function createComponent() {
  let launchConfig = Ember.Object.create({
    labels: {},
    ports: Ember.A(),
    secrets: Ember.A(),
  });
  let service = Ember.Object.create({
    name: 'web',
    scale: 1,
    launchConfig,
    secondaryLaunchConfigs: Ember.A(),
  });
  let component;

  Ember.run(() => {
    component = createOwned(NewContainerComponent, {
      renderer: inertRenderer(),
      intl: Ember.Object.create({t(key) { return key; }}),
      launchConfig,
      service,
      primaryResource: service,
      primaryService: service,
      isService: true,
    }, 'component');
  });

  return component;
}

test('preflight closure callback is invoked without legacy sendAction', function(assert) {
  let received;
  let component = createComponent();

  Ember.run(() => component.set('preflightChanged', (state) => {
    received = state;
  }));
  Ember.run(() => component.send('portPreflightChanged', {
    status: 'available',
    pending: false,
    blocked: false,
  }));

  assert.equal(received.status, 'available', 'passes the state to the closure callback');

  Ember.run(() => component.set('preflightChanged', null));
  Ember.run(() => component.send('portPreflightChanged', {
    status: 'warning',
    pending: false,
    blocked: false,
  }));
  assert.ok(true, 'missing optional callback does not throw');
  destroyOwned(component);
});

test('serialized port changes update the launch config through a named action', function(assert) {
  let component = createComponent();
  let ports = Ember.A(['19041:80/tcp']);

  Ember.run(() => component.send('setPorts', ports));

  assert.strictEqual(component.get('launchConfig.ports'), ports, 'stores the serialized port array');
  destroyOwned(component);
});

test('primary check disables save only while pending or blocked', function(assert) {
  let component = createComponent();

  assert.notOk(component.get('saveDisabled'), 'starts enabled');

  Ember.run(() => component.send('portPreflightChanged', {
    status: 'checking',
    pending: true,
    blocked: false,
  }));
  assert.ok(component.get('saveDisabled'), 'disables save during the live check');

  Ember.run(() => component.send('portPreflightChanged', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.ok(component.get('saveDisabled'), 'disables save for an active conflict');

  Ember.run(() => component.send('portPreflightChanged', {
    status: 'warning',
    pending: false,
    blocked: false,
  }));
  assert.notOk(component.get('saveDisabled'), 'allows a stopped-owner warning');

  destroyOwned(component);
});

test('sidekick checks participate in the parent save lock', function(assert) {
  let component = createComponent();

  Ember.run(() => component.send('sidekickPortPreflightChanged', 'side-a', {
    status: 'checking',
    pending: true,
    blocked: false,
  }));
  assert.ok(component.get('saveDisabled'), 'a pending sidekick disables save');

  Ember.run(() => component.send('sidekickPortPreflightChanged', 'side-a', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.ok(component.get('hasSidekickPortPreflightBlocked'), 'tracks a blocked sidekick');
  assert.ok(component.get('saveDisabled'), 'a blocked sidekick disables save');

  Ember.run(() => component.removeSidekickPortPreflightState('side-a'));
  assert.notOk(component.get('hasSidekickPortPreflightBlocked'), 'removes stale state with the sidekick');
  assert.notOk(component.get('saveDisabled'), 're-enables save after removing the blocked sidekick');

  destroyOwned(component);
});
