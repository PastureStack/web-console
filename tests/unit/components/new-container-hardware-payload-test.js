import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';

import NewContainerComponent from 'ui/components/new-container/component';
import NewServiceController from 'ui/service/new/controller';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new container hardware payload');

function hardwareLaunchConfig() {
  return EmberObject.create({
    labels: {},
    ports: A(),
    secrets: A(),
    shmSize: 2147483648,
    ipcMode: 'private',
    runtime: 'nvidia',
    runInit: true,
    pidsLimit: 512,
    cpuQuota: 200000,
    cpuPeriod: 100000,
    groupAdd: ['993'],
    tmpfs: {'/run': 'rw,noexec,nosuid,size=64m'},
    sysctls: {'net.core.somaxconn': '1024'},
    ulimits: [{name: 'memlock', soft: -1, hard: -1}],
    devices: ['/dev/dri/renderD128:/dev/dri/renderD128:rw'],
    deviceRequests: [{driver: 'nvidia', count: 1, capabilities: [['gpu']]}],
    requestedHostId: '1h1',
  });
}

function createComponent(service, launchConfig, extra = {}) {
  let component;

  run(() => {
    component = createOwned(NewContainerComponent, Object.assign({
      renderer: inertRenderer(),
      intl: EmberObject.create({t(key) { return key; }}),
      launchConfig,
      service,
      primaryResource: service,
      primaryService: service,
      isService: true,
    }, extra), 'component');
  });

  return component;
}

function hardwareSnapshot(config) {
  return {
    shmSize: config.get('shmSize'),
    ipcMode: config.get('ipcMode'),
    runtime: config.get('runtime'),
    runInit: config.get('runInit'),
    pidsLimit: config.get('pidsLimit'),
    cpuQuota: config.get('cpuQuota'),
    cpuPeriod: config.get('cpuPeriod'),
    groupAdd: config.get('groupAdd'),
    tmpfs: config.get('tmpfs'),
    sysctls: config.get('sysctls'),
    ulimits: config.get('ulimits'),
    devices: config.get('devices'),
    deviceRequests: config.get('deviceRequests'),
    requestedHostId: config.get('requestedHostId'),
  };
}

function upgradeLaunchConfig(name) {
  let config = hardwareLaunchConfig();
  config.setProperties({
    name,
    imageUuid: 'docker:example/workload:next',
    environment: {MODE: 'upgrade', KEEP: 'value'},
    dataVolumes: ['/srv/data:/data:rw'],
    dataVolumesFrom: ['1i-data'],
    ports: A(['18080:8080/tcp']),
    command: ['serve', '--port=8080'],
    privileged: false,
    capAdd: ['NET_BIND_SERVICE'],
    capDrop: ['SYS_ADMIN'],
    securityOpt: ['no-new-privileges'],
    readOnly: true,
    serialize() {
      let out = {};
      Object.keys(this).forEach((key) => {
        if ( typeof this[key] !== 'function' ) {
          out[key] = this[key];
        }
      });
      return out;
    },
  });
  return config;
}

async function settleUpgradeTurn() {
  for (let turn = 0; turn < 20; turn++) {
    await resolve();
  }
}

function save(component, callback) {
  return component.get('actions').save.call(component, callback);
}

test('service creation retains every resource and hardware launch field', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let saved;
  let service = EmberObject.create({
    launchConfig,
    secondaryLaunchConfigs: A(),
    save() {
      saved = hardwareSnapshot(this.get('launchConfig'));
      return Promise.resolve(this);
    },
  });
  let component = createComponent(service, launchConfig);

  await component.doSave();

  assert.deepEqual(saved, hardwareSnapshot(launchConfig), 'create payload keeps all configured fields');
  destroyOwned(component);
});

test('first service creation keeps the saved service through links and navigation', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let navigationResource;
  let linkActionCount = 0;
  let service = EmberObject.create({
    id: '1s-new',
    stackId: '1st-new',
    launchConfig,
    secondaryLaunchConfigs: A(),
    save() { return Promise.resolve(this); },
    doAction() {
      linkActionCount++;
      return Promise.resolve();
    },
  });
  let legacyDispatchCount = 0;
  let component = createComponent(service, launchConfig);

  run(() => component.setProperties({
    serviceLinksArray: A(),
    sendAction() {
      legacyDispatchCount++;
      throw new TypeError("Cannot read properties of undefined (reading 'get')");
    },
    done(resource) {
      navigationResource = resource;
      return Promise.resolve();
    },
  }));

  let saved = await component.doSave();
  let linked = await component.didSave(saved);

  await component.doneSaving(linked);

  assert.equal(linkActionCount, 0, 'an empty link set does not issue a redundant action');
  assert.equal(legacyDispatchCount, 0, 'a closure action bypasses the deprecated sendAction path');
  assert.strictEqual(linked, service, 'link action does not discard the persisted service');
  assert.strictEqual(navigationResource, service, 'navigation receives the saved service without an unrelated reload');
  destroyOwned(component);
});

test('bound create completion keeps the controller receiver and leaves the form', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let transition;
  let service = EmberObject.create({
    id: '1s-new',
    stackId: '1st-query',
    launchConfig,
    secondaryLaunchConfigs: A(),
    save() { return Promise.resolve(this); },
  });
  let controller = NewServiceController.create({
    stackId: '1st-query',
    router: {
      transitionTo(route, stackId) {
        transition = {route, stackId};
        return Promise.resolve();
      },
    },
  });
  let component = createComponent(service, launchConfig);

  run(() => component.setProperties({
    serviceLinksArray: A(),
    done: controller.get('newContainerDoneAction'),
    sendAction() {
      throw new Error('bound route completion must not use classic action targeting');
    },
  }));

  let saved = await component.doSave();
  let linked = await component.didSave(saved);

  await component.doneSaving(linked);

  assert.deepEqual(transition, {route: 'stack', stackId: '1st-query'},
    'the detached completion action retains its controller and navigates to the owning stack');
  destroyOwned(component);
  run(() => controller.destroy());
});

test('service link persistence keeps the saved service without reading response route fields', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let service = EmberObject.create({
    launchConfig,
    secondaryLaunchConfigs: A(),
    save() { return Promise.resolve(this); },
  });
  let savedResource = {
    get() {
      throw new Error('completion must not read fields from the saved response');
    },
    doAction(name) {
      assert.equal(name, 'setservicelinks');
      return Promise.resolve();
    },
  };
  let component = createComponent(service, launchConfig);

  run(() => component.set('serviceLinksArray', A([{serviceId: '1s-linked', name: 'db'}])));
  let linked = await component.didSave(savedResource);

  assert.strictEqual(linked, savedResource, 'the persisted service stays in the completion chain');
  destroyOwned(component);
});

test('service upgrade sends every resource and hardware field in the upgrade strategy', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let action;
  let payload;
  let service = EmberObject.create({
    launchConfig,
    secondaryLaunchConfigs: A(),
    save() { return Promise.resolve(this); },
    waitForAction(name) {
      assert.equal(name, 'upgrade', 'waits for the upgrade action');
      return Promise.resolve();
    },
    doAction(name, value) {
      action = name;
      payload = value;
      return Promise.resolve();
    },
  });
  let component = createComponent(service, launchConfig);

  run(() => component.setProperties({
    isUpgrade: true,
    upgradeOptions: {batchSize: 1, intervalMillis: 2000, startFirst: false},
  }));
  await component.doSave();

  assert.equal(action, 'upgrade');
  assert.deepEqual(hardwareSnapshot(payload.inServiceStrategy.launchConfig), hardwareSnapshot(launchConfig),
    'upgrade payload keeps all configured fields');
  destroyOwned(component);
});

test('service upgrade bypasses stale endpoint saves and owns completion through links and navigation', async function(assert) {
  let launchConfig = upgradeLaunchConfig('primary');
  let secondary = upgradeLaunchConfig('worker');
  let excluded = upgradeLaunchConfig('unchanged');
  let waiting = defer();
  let upgrading = defer();
  let linking = defer();
  let navigating = defer();
  let calls = [];
  let callbacks = [];
  let duplicateCallbacks = [];
  let saveCalls = 0;
  let payload;
  let service = EmberObject.create({
    id: '1s-upgrade',
    launchConfig,
    secondaryLaunchConfigs: A([secondary, excluded]),
    publicEndpoints: [{port: 18080, instanceId: '1i-deleted'}],
    save() {
      saveCalls++;
      throw new Error('422: stale publicEndpoints.instanceId must not be saved');
    },
    waitForAction(name) {
      calls.push(`wait:${name}`);
      return waiting.promise;
    },
    doAction(name, value) {
      calls.push(name);
      if ( name === 'upgrade' ) {
        payload = value;
        return upgrading.promise;
      }
      assert.deepEqual(value, {serviceLinks: [{name: 'db', serviceId: '1s-db'}]});
      return linking.promise;
    },
  });
  let component = createComponent(service, launchConfig, {
    isUpgrade: true,
    upgradeOptions: {batchSize: 2, intervalMillis: 3500, startFirst: true},
    launchConfigChoices: A([
      {index: -1, enabled: true},
      {index: 0, enabled: true},
      {index: 1, enabled: false},
    ]),
    serviceLinksArray: A([{name: 'db', serviceId: '1s-db'}]),
    validate() { calls.push('validate'); return true; },
    done(resource) {
      assert.strictEqual(resource, service, 'navigation receives the upgraded service');
      calls.push('done');
      return navigating.promise;
    },
  });
  let operation = save(component, value => callbacks.push(value));

  await settleUpgradeTurn();
  assert.equal(saveCalls, 0, 'the complete clone with a stale endpoint is never saved');
  assert.deepEqual(calls, ['validate', 'wait:upgrade'], 'validation precedes waiting and no action runs early');
  assert.true(component.get('saving'), 'saving remains locked while waiting');
  assert.deepEqual(await save(component, value => duplicateCallbacks.push(value)), {saved: false, reason: 'busy'});

  waiting.resolve();
  await settleUpgradeTurn();
  assert.deepEqual(calls, ['validate', 'wait:upgrade', 'upgrade'], 'only one upgrade starts after readiness');
  if ( payload ) {
    assert.deepEqual(Object.keys(payload), ['inServiceStrategy'], 'the request contains only the upgrade strategy');
    assert.deepEqual(payload.inServiceStrategy, {
      batchSize: 2,
      intervalMillis: 3500,
      startFirst: true,
      launchConfig,
      secondaryLaunchConfigs: [secondary.serialize()],
    }, 'primary, enabled secondary, strategy, volumes, ports, environment, hardware and security stay complete');
  }
  assert.true(component.get('saving'), 'saving remains locked during upgrade');
  assert.deepEqual(callbacks, [], 'callback does not finish before upgrade');

  upgrading.resolve({state: 'upgrading'});
  await settleUpgradeTurn();
  assert.deepEqual(calls, ['validate', 'wait:upgrade', 'upgrade', 'setservicelinks'], 'links follow successful upgrade');
  assert.true(component.get('saving'), 'saving remains locked through links');
  assert.deepEqual(await save(component, value => duplicateCallbacks.push(value)), {saved: false, reason: 'busy'});

  linking.resolve();
  await settleUpgradeTurn();
  assert.deepEqual(calls, ['validate', 'wait:upgrade', 'upgrade', 'setservicelinks', 'done']);
  assert.true(component.get('saving'), 'saving remains locked until navigation resolves');
  assert.deepEqual(callbacks, [], 'callback waits for navigation too');

  navigating.resolve();
  let result = await operation;
  assert.strictEqual(result, service, 'the original service stays in the completion chain');
  assert.equal(saveCalls, 0);
  assert.deepEqual(callbacks, [true], 'the owning callback completes exactly once');
  assert.deepEqual(duplicateCallbacks, [false, false], 'each duplicate completes once without releasing the lock');
  assert.false(component.get('saving'));
  assert.strictEqual(component._saveOwner, null);
  destroyOwned(component);
});

for (let stage of ['wait', 'upgrade']) {
  test(`failed service upgrade ${stage} does not update links or navigate`, async function(assert) {
    let launchConfig = upgradeLaunchConfig('primary');
    let failure = new Error(`${stage} rejected`);
    let callbacks = [];
    let calls = [];
    let saveCalls = 0;
    let service = EmberObject.create({
      launchConfig,
      secondaryLaunchConfigs: A(),
      publicEndpoints: [{port: 18080, instanceId: '1i-deleted'}],
      save() { saveCalls++; throw new Error('stale endpoint save'); },
      waitForAction() {
        calls.push('wait');
        return stage === 'wait' ? Promise.reject(failure) : Promise.resolve();
      },
      doAction(name) {
        calls.push(name);
        return Promise.reject(failure);
      },
    });
    let component = createComponent(service, launchConfig, {
      isUpgrade: true,
      upgradeOptions: {batchSize: 1, intervalMillis: 2000, startFirst: false},
      serviceLinksArray: A([{name: 'db', serviceId: '1s-db'}]),
      validate() { return true; },
      send(name, error) {
        assert.equal(name, 'error');
        assert.strictEqual(error, failure, 'the actual action failure is reported');
      },
      done() { calls.push('done'); },
    });

    let result = await save(component, value => callbacks.push(value));

    assert.equal(saveCalls, 0, 'no generic persistence is attempted');
    assert.strictEqual(result.error, failure);
    assert.deepEqual(calls, stage === 'wait' ? ['wait'] : ['wait', 'upgrade'], 'failure ends the lifecycle before links and navigation');
    assert.deepEqual(callbacks, [false], 'failure completes its callback exactly once');
    assert.false(component.get('saving'), 'failure releases saving');
    assert.strictEqual(component._saveOwner, null);
    destroyOwned(component);
  });
}

test('service upgrade still stops at validation before any persistence or action', async function(assert) {
  let launchConfig = hardwareLaunchConfig();
  let persistenceCalls = [];
  let callbacks = [];
  let service = EmberObject.create({
    launchConfig,
    secondaryLaunchConfigs: A(),
    validationErrors() { return A(['invalid service']); },
    save() { persistenceCalls.push('save'); return Promise.resolve(this); },
    waitForAction() { persistenceCalls.push('wait'); return Promise.resolve(); },
    doAction(name) { persistenceCalls.push(name); return Promise.resolve(); },
  });
  let component = createComponent(service, launchConfig, {
    isUpgrade: true,
    done() { persistenceCalls.push('done'); },
  });

  let outcome = await save(component, value => callbacks.push(value));

  assert.deepEqual(outcome, {saved: false, reason: 'cancelled'});
  assert.ok(component.get('errors').includes('invalid service'), 'native validation is still used');
  assert.deepEqual(persistenceCalls, []);
  assert.deepEqual(callbacks, [false]);
  assert.false(component.get('saving'));
  destroyOwned(component);
});

for (let state of ['pending', 'blocked']) {
  test(`service upgrade preserves a ${state} sidekick preflight guard`, async function(assert) {
    let launchConfig = EmberObject.create({labels: {}, ports: A(), secrets: A()});
    let calls = [];
    let service = EmberObject.create({
      launchConfig,
      secondaryLaunchConfigs: A(),
      validationErrors() { return A(); },
      save() { calls.push('save'); return Promise.resolve(this); },
      waitForAction() { calls.push('wait'); return Promise.resolve(); },
      doAction(name) { calls.push(name); return Promise.resolve(); },
    });
    let component = createComponent(service, launchConfig, {
      isUpgrade: true,
      done() { calls.push('done'); },
    });
    let callbacks = [];

    run(() => component.set('sidekickPortPreflightStates', {worker: {[state]: true}}));

    assert.true(component.get('saveDisabled'), 'the form disables save for the preflight state');
    assert.deepEqual(await save(component, value => callbacks.push(value)), {saved: false, reason: 'cancelled'});
    assert.deepEqual(calls, [], 'programmatic submission also stops before any action');
    assert.deepEqual(callbacks, [false]);
    assert.false(component.get('saving'));
    destroyOwned(component);
  });
}
