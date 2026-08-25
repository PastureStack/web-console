import { resolve, Promise } from 'rsvp';
import { A } from '@ember/array';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import FormPortsComponent from 'ui/components/form-ports/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | form ports');

function intlStub() {
  return EmberObject.create({
    t(key, values) {
      if ( values && values.value ) {
        return `${key}:${values.value}`;
      }

      return key;
    },
  });
}

function portRow(publicPort, privatePort, protocol) {
  return EmberObject.create({
    bindAddress: null,
    public: publicPort,
    private: privatePort,
    protocol: protocol || 'tcp',
  });
}

function createComponent(project, properties) {
  let component;

  run(() => {
    component = createOwned(FormPortsComponent, Object.assign({
      renderer: inertRenderer(),
      intl: intlStub(),
      projects: EmberObject.create({current: project}),
      initialPorts: A(),
      schedulePortPreflight() {},
    }, properties || {}), 'component');
  });

  return component;
}

test('closure callbacks are invoked directly and missing optional callbacks are ignored', function(assert) {
  let changedRows;
  let changedSpecs;
  let preflightState;
  let component = createComponent(null, {
    changed(value) {
      changedRows = value;
    },
    changedStr(value) {
      changedSpecs = value;
    },
    preflightChanged(value) {
      preflightState = value;
    },
    sendAction() {
      assert.ok(false, 'closure callbacks must not be routed through legacy sendAction');
    },
  });
  let row = portRow('8080', '80');

  run(() => component.set('portsArray', A([row])));
  component.portsArrayDidChange();
  component.applyPreflightState('available', [], null, {
    eligibleHostCount: 1,
    availableHostCount: 1,
  });

  assert.strictEqual(changedRows, component.get('portsArray'), 'passes the live row array');
  assert.deepEqual(changedSpecs, ['8080:80/tcp'], 'passes the serialized port specs');
  assert.equal(preflightState.status, 'available', 'passes the preflight result');

  run(() => component.setProperties({
    changed: null,
    changedStr: null,
    preflightChanged: null,
  }));
  component.portsArrayDidChange();
  component.applyPreflightState('available', [], null, null);
  assert.ok(true, 'missing optional callbacks do not throw');
  destroyOwned(component);
});

function projectWithAction(callback) {
  return EmberObject.create({
    actionLinks: {portpreflight: '/v2-beta/projects/1a5?action=portpreflight'},
    hasAction(name) {
      return name === 'portpreflight';
    },
    doAction(name, payload) {
      return callback(name, payload);
    },
  });
}

test('managed owner on another host blocks saving and identifies the workload', function(assert) {
  let captured;
  let project = projectWithAction((name, payload) => {
    captured = {name, payload};
    return resolve(EmberObject.create({
      status: 'blocked',
      eligibleHostCount: 1,
      availableHostCount: 0,
      conflicts: A([EmberObject.create({
        severity: 'blocked',
        reasonCode: 'active_port_conflict_on_other_host',
        hostName: 'node-a',
        stackName: 'payments',
        serviceName: 'api',
        instanceName: 'api-1',
        state: 'running',
        bindAddress: '0.0.0.0',
        publicPort: 8080,
        privatePort: 80,
        protocol: 'tcp',
      })]),
    }));
  });
  let component = createComponent(project, {
    networkMode: 'managed',
    requestedHostId: '1h1',
    serviceId: '1s1',
    stackId: '1st1',
    scale: 1,
  });
  let row = portRow('8080', '80');

  run(() => component.set('portsArray', A([row])));
  component._preflightSequence = 1;

  return component.runPortPreflight(1).then(() => {
    assert.equal(captured.name, 'portpreflight', 'uses the project preflight action');
    assert.deepEqual(captured.payload.ports, [{
      bindAddress: null,
      publicPort: 8080,
      privatePort: 80,
      protocol: 'tcp',
    }], 'sends the normalized port rule');
    assert.equal(captured.payload.requestedHostId, '1h1', 'keeps the requested host');
    assert.equal(component.get('preflightStatus'), 'blocked', 'marks the form blocked');
    assert.equal(row.get('preflightStatus'), 'blocked', 'marks the conflicting row blocked');
    assert.ok(component.get('errors').includes('formPorts.preflight.error.blocked'), 'publishes a blocking validation error');
    assert.ok(component.get('preflightConflictMessages.firstObject.text').includes('active_port_conflict_on_other_host'), 'uses the managed environment-wide conflict message');
    assert.ok(component.get('preflightConflictMessages.firstObject.text').includes('node-a'), 'shows the host');
    assert.ok(component.get('preflightConflictMessages.firstObject.text').includes('payments'), 'shows the stack');
    assert.ok(component.get('preflightConflictMessages.firstObject.text').includes('api-1'), 'shows the container');
    destroyOwned(component);
  });
});

test('stopped owner is a warning and does not block saving', function(assert) {
  let project = projectWithAction(() => resolve(EmberObject.create({
    status: 'warning',
    eligibleHostCount: 2,
    availableHostCount: 2,
    conflicts: A([EmberObject.create({
      severity: 'warning',
      reasonCode: 'stopped_port_owner',
      hostName: 'node-b',
      instanceName: 'old-web',
      state: 'stopped',
      publicPort: 8443,
      privatePort: 443,
      protocol: 'tcp',
    })]),
  })));
  let component = createComponent(project, {networkMode: 'bridge'});
  let row = portRow('8443', '443');

  run(() => component.set('portsArray', A([row])));
  component._preflightSequence = 1;

  return component.runPortPreflight(1).then(() => {
    assert.equal(component.get('preflightStatus'), 'warning', 'keeps the form in warning state');
    assert.equal(row.get('preflightStatus'), 'warning', 'marks the affected row yellow');
    assert.notOk(component.get('errors').includes('formPorts.preflight.error.blocked'), 'does not add a blocking error');
    destroyOwned(component);
  });
});

test('host networking checks the container port and reports misleading remapping', function(assert) {
  let captured;
  let project = projectWithAction((name, payload) => {
    captured = payload;
    return resolve(EmberObject.create({
      status: 'blocked',
      eligibleHostCount: 1,
      availableHostCount: 0,
      conflicts: A([EmberObject.create({
        severity: 'blocked',
        source: 'request',
        reasonCode: 'host_network_ignores_published_port',
        state: 'host',
        publicPort: 2201,
        privatePort: 22,
        protocol: 'tcp',
      })]),
    }));
  });
  let component = createComponent(project, {networkMode: 'host'});
  let row = portRow('2201', '22');

  run(() => component.set('portsArray', A([row])));
  component._preflightSequence = 1;

  return component.runPortPreflight(1).then(() => {
    assert.equal(captured.networkMode, 'host', 'sends host network mode');
    assert.equal(captured.ports[0].publicPort, 2201, 'preserves the entered host port');
    assert.equal(captured.ports[0].privatePort, 22, 'preserves the effective host-network port');
    assert.equal(row.get('preflightStatus'), 'blocked', 'maps the server conflict back to the row');
    destroyOwned(component);
  });
});

test('a late older response cannot replace the newest result', function(assert) {
  let resolvers = [];
  let project = projectWithAction(() => new Promise((resolve) => resolvers.push(resolve)));
  let component = createComponent(project, {networkMode: 'managed'});
  let row = portRow('8080', '80');

  run(() => component.set('portsArray', A([row])));
  component._preflightSequence = 1;
  let oldRequest = component.runPortPreflight(1);

  component._preflightSequence = 2;
  let newRequest = component.runPortPreflight(2);

  run(() => resolvers[1](EmberObject.create({
    status: 'available',
    eligibleHostCount: 2,
    availableHostCount: 2,
    conflicts: A(),
  })));

  return newRequest.then(() => {
    assert.equal(component.get('preflightStatus'), 'available', 'applies the newest response');

    run(() => resolvers[0](EmberObject.create({
      status: 'blocked',
      eligibleHostCount: 2,
      availableHostCount: 0,
      conflicts: A(),
    })));

    return oldRequest;
  }).then(() => {
    assert.equal(component.get('preflightStatus'), 'available', 'ignores the late older response');
    assert.equal(row.get('preflightStatus'), 'available', 'keeps the newest row state');
    destroyOwned(component);
  });
});
