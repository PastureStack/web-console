import { run } from '@ember/runloop';
import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import NewContainerComponent from 'ui/components/new-container/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new container port preflight');

function createComponent() {
  let launchConfig = EmberObject.create({
    labels: {},
    ports: A(),
    secrets: A(),
  });
  let service = EmberObject.create({
    name: 'web',
    scale: 1,
    launchConfig,
    secondaryLaunchConfigs: A(),
    validationErrors() {
      return A();
    },
  });
  let component;

  run(() => {
    component = createOwned(NewContainerComponent, {
      renderer: inertRenderer(),
      intl: EmberObject.create({t(key) { return key; }}),
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

  run(() => component.set('preflightChanged', (state) => {
    received = state;
  }));
  run(() => component.send('portPreflightChanged', {
    status: 'available',
    pending: false,
    blocked: false,
  }));

  assert.equal(received.status, 'available', 'passes the state to the closure callback');

  run(() => component.set('preflightChanged', null));
  run(() => component.send('portPreflightChanged', {
    status: 'warning',
    pending: false,
    blocked: false,
  }));
  assert.ok(true, 'missing optional callback does not throw');
  destroyOwned(component);
});

test('combined preflight status ignores idle and keeps the most important result', function(assert) {
  let received;
  let component = createComponent();

  run(() => component.set('preflightChanged', (state) => {
    received = state;
  }));

  run(() => component.send('portPreflightChanged', {
    status: 'available',
    pending: false,
    blocked: false,
  }));
  assert.equal(received.status, 'available', 'an idle volume check does not hide an available port result');

  run(() => component.send('volumePreflightChanged', {
    status: 'warning',
    pending: false,
    blocked: false,
  }));
  assert.equal(received.status, 'warning', 'a warning takes precedence over an available result');

  run(() => component.send('portPreflightChanged', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.equal(received.status, 'blocked', 'a blocking result takes precedence over every non-blocking result');

  destroyOwned(component);
});

test('serialized port changes update the launch config through a named action', function(assert) {
  let component = createComponent();
  let ports = A(['19041:80/tcp']);

  run(() => component.send('setPorts', ports));

  assert.strictEqual(component.get('launchConfig.ports'), ports, 'stores the serialized port array');
  destroyOwned(component);
});

test('primary check disables save only while pending or blocked', function(assert) {
  let component = createComponent();

  assert.notOk(component.get('saveDisabled'), 'starts enabled');

  run(() => component.send('portPreflightChanged', {
    status: 'checking',
    pending: true,
    blocked: false,
  }));
  assert.ok(component.get('saveDisabled'), 'disables save during the live check');

  run(() => component.send('portPreflightChanged', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.ok(component.get('saveDisabled'), 'disables save for an active conflict');

  run(() => component.send('portPreflightChanged', {
    status: 'warning',
    pending: false,
    blocked: false,
  }));
  assert.notOk(component.get('saveDisabled'), 'allows a stopped-owner warning');

  destroyOwned(component);
});

test('a transient volume recheck cannot become a stale save error', function(assert) {
  let component = createComponent();

  run(() => component.send('volumePreflightChanged', {
    status: 'checking',
    pending: true,
    blocked: false,
  }));

  assert.ok(component.get('saveDisabled'), 'the button remains disabled while the live check is pending');
  assert.ok(component.validate(), 'server-side save validation remains authoritative if a recheck races with the click');
  assert.notOk(component.get('errors'), 'does not leave a stale checking error after the live result is available');

  destroyOwned(component);
});

test('sidekick checks participate in the parent save lock', function(assert) {
  let component = createComponent();

  run(() => component.send('sidekickPortPreflightChanged', 'side-a', {
    status: 'checking',
    pending: true,
    blocked: false,
  }));
  assert.ok(component.get('saveDisabled'), 'a pending sidekick disables save');

  run(() => component.send('sidekickPortPreflightChanged', 'side-a', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.ok(component.get('hasSidekickPortPreflightBlocked'), 'tracks a blocked sidekick');
  assert.ok(component.get('saveDisabled'), 'a blocked sidekick disables save');

  run(() => component.removeSidekickPortPreflightState('side-a'));
  assert.notOk(component.get('hasSidekickPortPreflightBlocked'), 'removes stale state with the sidekick');
  assert.notOk(component.get('saveDisabled'), 're-enables save after removing the blocked sidekick');

  destroyOwned(component);
});

test('service upgrade exposes the exact service and rolling-update context to preflight', function(assert) {
  let component = createComponent();

  run(() => {
    component.setProperties({
      isUpgrade: true,
      'service.id': '1s55',
      'service.stackId': '1st9',
      'service.scale': 4,
    });
    component.send('setUpgrade', {
      batchSize: 2,
      startFirst: true,
    });
  });

  assert.equal(component.get('preflightServiceId'), '1s55', 'checks the service being upgraded');
  assert.equal(component.get('preflightStackId'), '1st9', 'includes the owning stack');
  assert.equal(component.get('preflightScale'), 4, 'includes the service scale');
  assert.equal(component.get('preflightBatchSize'), 2, 'includes concurrent upgrade capacity');
  assert.ok(component.get('preflightStartFirst'), 'includes start-first placement semantics');

  run(() => component.send('setPorts', A(['18080:8080/tcp'])));
  assert.deepEqual(component.get('launchConfig.ports'), ['18080:8080/tcp'], 'retains newly added upgrade ports');

  run(() => component.send('portPreflightChanged', {
    status: 'blocked',
    pending: false,
    blocked: true,
  }));
  assert.ok(component.get('saveDisabled'), 'blocks the upgrade while the new port conflicts');

  destroyOwned(component);
});
