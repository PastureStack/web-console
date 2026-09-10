import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import NewContainerComponent from 'ui/components/new-container/component';
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

function createComponent(service, launchConfig) {
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
  assert.strictEqual(navigationResource, service, 'navigation receives the persisted service');
  destroyOwned(component);
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
