import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { defer, resolve, reject } from 'rsvp';
import { module, test } from 'qunit';
import Resource from 'ember-api-store/models/resource';
import NewBalancerComponent from 'ui/components/new-balancer/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | new balancer upgrade');

const OLD_IMAGE = 'docker:ghcr.io/pasturestack/load-balancer-service:v0.9.34';
const NEW_IMAGE = 'docker:ghcr.io/pasturestack/load-balancer-service:v0.9.35';

function record(values) {
  return Resource.create(Object.assign({validationErrors() { return A(); }}, values));
}

function snapshot(value) {
  if ( value && typeof value.serialize === 'function' ) {
    return value.serialize();
  }
  return value;
}

function setup(extra = {}) {
  let calls = [];
  let requests = [];
  let callbacks = [];
  let oldConfig = {
    imageUuid: OLD_IMAGE, labels: {keep: 'label'},
    ports: ['18090:18090/tcp'], expose: ['18443:18443/tcp'],
    requestedHostId: '1h1', healthCheck: {port: 42, interval: 2000},
    environment: {KEEP: 'value'}, dataVolumes: ['/data:/data'],
    shmSize: 2147483648, runtime: 'runc', capAdd: ['NET_BIND_SERVICE'],
  };
  let secondary = {name: 'sidekick', imageUuid: 'docker:example/sidekick:1', environment: {KEEP: 'sidekick'}};
  let lbConfig = {
    type: 'lbConfig',
    portRules: [
      {type: 'portRule', protocol: 'http', sourcePort: 18090, targetPort: 80, serviceId: '1s-target'},
      {type: 'portRule', protocol: 'https', sourcePort: 18443, targetPort: 80, serviceId: '1s-target'},
    ],
    certificateIds: ['1c-extra'], defaultCertificateId: '1c-default',
    stickinessPolicy: {name: 'session', cookie: 'keep', mode: 'insert'},
  };
  let persisted = {launchConfig: structuredClone(oldConfig), secondaryLaunchConfigs: [structuredClone(secondary)], lbConfig: structuredClone(lbConfig)};
  let existing = record({name: 'balancer', description: 'kept description', scale: 1, lbConfig: record(lbConfig)});
  let previousLaunchConfig;
  let service = record({
    id: '1s-lb', type: 'loadBalancerService', name: 'balancer', description: 'kept description', scale: 1,
    links: {self: '/services/1s-lb'}, actionLinks: {upgrade: '/services/1s-lb?action=upgrade'},
    launchConfig: record(Object.assign({}, oldConfig, {imageUuid: NEW_IMAGE})),
    secondaryLaunchConfigs: A([record(secondary)]),
    lbConfig: record(Object.assign({}, lbConfig, {
      portRules: A(lbConfig.portRules.map((rule) => record(rule))), config: null, needsCertificate: true,
    })),
    publicEndpoints: [{instanceId: '1i-deleted', port: 18090}],
    initPorts() {},
    waitForAction(name) { calls.push(`wait:${name}`); return resolve(); },
    request(options) {
      requests.push(options);
      calls.push(options.method);
      if ( options.method === 'PUT' ) {
        Object.assign(persisted, structuredClone(options.data));
      } else {
        previousLaunchConfig = structuredClone(persisted.launchConfig);
        persisted.launchConfig = structuredClone(options.data.inServiceStrategy.launchConfig);
      }
      return resolve(null);
    },
  });
  // needsCertificate is a computed model property, not serialized API data.
  service.get('lbConfig').set('reservedKeys', service.get('lbConfig.reservedKeys').concat(['needsCertificate']));
  let component;
  run(() => {
    component = createOwned(NewBalancerComponent, Object.assign({
      renderer: inertRenderer(),
      intl: EmberObject.create({t(key) { return key; }}),
      service, existing, editing: true, upgradeImage: 'true',
      upgradeOptions: {batchSize: 2, intervalMillis: 3500, startFirst: true},
      validateRules() { calls.push('validateRules'); this.set('ruleErrors', []); },
      sendAction(name, value) { calls.push(name); return value; },
    }, extra), 'component');
  });
  return {component, service, existing, calls, requests, callbacks, persisted, oldConfig, secondary, lbConfig,
    previous: () => previousLaunchConfig,
    save: () => component.get('actions').save.call(component, (ok) => callbacks.push(ok)),
  };
}

async function turn() {
  for (let i = 0; i < 20; i++) {
    await resolve();
  }
}

test('image upgrade follows the UI save chain without a PUT or rollback-source pollution', async function(assert) {
  let fixture = setup();
  let {component, service, calls, requests, callbacks, oldConfig, secondary} = fixture;
  let result = await fixture.save();

  assert.strictEqual(result, service, 'completion retains the edited service');
  assert.deepEqual(calls, ['validateRules', 'wait:upgrade', 'POST', 'done'], 'validation, native upgrade and completion each run once');
  assert.equal(requests.filter((request) => request.method === 'PUT').length, 0, 'no save or full-clone PUT precedes upgrade');
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1, 'exactly one native upgrade is submitted');
  assert.deepEqual(requests[0].data, {inServiceStrategy: {
    batchSize: 2, intervalMillis: 3500, startFirst: true,
    launchConfig: snapshot(service.get('launchConfig')), secondaryLaunchConfigs: [secondary],
  }}, 'full primary and secondary configuration and strategy survive the upgrade');
  assert.deepEqual(fixture.previous(), oldConfig, 'the server still captures the old image and configuration for rollback');
  assert.equal(fixture.previous().imageUuid, OLD_IMAGE);
  assert.deepEqual(fixture.persisted.lbConfig, fixture.lbConfig, 'absent custom config versus null does not trigger metadata persistence');
  assert.deepEqual(callbacks, [true]);
  assert.false(component.get('saving'));
  destroyOwned(component);
});

test('real metadata edits PUT only the editable fields and retain complete LB settings', async function(assert) {
  let fixture = setup();
  let {component, service, requests} = fixture;
  run(() => {
    service.set('name', 'renamed');
    service.set('description', 'edited');
    service.set('scale', 2);
    service.set('lbConfig.config', 'timeout connect 10s');
    service.set('lbConfig.defaultCertificateId', '1c-new');
  });
  let expectedConfig = snapshot(service.get('lbConfig'));

  await fixture.save();

  assert.equal(requests.length, 2, 'bounded metadata update and native upgrade only');
  assert.deepEqual(requests[0].data, {name: 'renamed', description: 'edited', scale: 2, lbConfig: expectedConfig});
  assert.equal(requests[0].method, 'PUT');
  assert.equal(requests[1].method, 'POST');
  assert.deepEqual(fixture.persisted.lbConfig, expectedConfig, 'rules, all certificates, stickiness and custom config remain complete');
  assert.equal(fixture.previous().imageUuid, OLD_IMAGE, 'partial metadata persistence cannot alter the rollback launch config');
  destroyOwned(component);
});

test('clearing a real LB value is not hidden by nullable custom-config equivalence', async function(assert) {
  let fixture = setup();
  run(() => fixture.service.set('lbConfig.certificateIds', null));
  await fixture.save();
  assert.equal(fixture.requests[0].method, 'PUT', 'a certificate change is still persisted');
  assert.strictEqual(fixture.requests[0].data.lbConfig.certificateIds, null);
  destroyOwned(fixture.component);
});

test('saving owns its lock until upgrade and completion hooks finish', async function(assert) {
  let waiting = defer();
  let upgrading = defer();
  let didSave = defer();
  let fixture = setup({didSave(service) { return didSave.promise.then(() => service); }});
  let {component, service, requests, callbacks} = fixture;
  run(() => {
    service.set('waitForAction', () => waiting.promise);
    service.set('doAction', () => { requests.push('upgrade'); return upgrading.promise; });
  });
  let operation = fixture.save();
  await turn();
  assert.true(component.get('saving'));
  assert.deepEqual(await fixture.save(), {saved: false, reason: 'busy'});
  waiting.resolve();
  await turn();
  assert.deepEqual(requests, ['upgrade']);
  upgrading.resolve();
  await turn();
  assert.true(component.get('saving'), 'the lock includes the completion hook');
  assert.deepEqual(callbacks, [false], 'only the duplicate has completed');
  didSave.resolve();
  await operation;
  assert.deepEqual(callbacks, [false, true]);
  assert.false(component.get('saving'));
  assert.strictEqual(component._saveOwner, null);
  destroyOwned(component);
});

for (let stage of ['metadata', 'wait', 'upgrade']) {
  test(`failure during ${stage} stops submission and retains retry ownership`, async function(assert) {
    let fixture = setup();
    let {component, service, calls, requests, callbacks} = fixture;
    let error = new Error(`${stage} failed`);
    run(() => {
      if ( stage === 'metadata' ) {
        service.set('description', 'edited');
        service.set('save', () => reject(error));
      } else if ( stage === 'wait' ) {
        service.set('waitForAction', () => reject(error));
      } else {
        service.set('doAction', () => reject(error));
      }
      component.set('send', (name, failure) => { assert.equal(name, 'error'); assert.strictEqual(failure, error); });
      component.set('errorSaving', (failure) => { assert.strictEqual(failure, error); calls.push('errorSaving'); });
    });
    let outcome = await fixture.save();
    assert.strictEqual(outcome.error, error);
    assert.notOk(calls.includes('done'), 'failure never navigates');
    assert.equal(calls.filter((call) => call === 'errorSaving').length, 1);
    assert.equal(requests.length, 0, 'no later persistence is attempted');
    assert.deepEqual(callbacks, [false]);
    assert.false(component.get('saving'));
    assert.strictEqual(component._saveOwner, null);
    destroyOwned(component);
  });
}

for (let field of ['ruleErrors', 'schedulingErrors', 'scaleErrors']) {
  test(`${field} stops the actual save chain before persistence`, async function(assert) {
    let fixture = setup({validateRules() {}});
    run(() => fixture.component.set(field, ['blocked by validation']));
    assert.deepEqual(await fixture.save(), {saved: false, reason: 'cancelled'});
    assert.deepEqual(fixture.requests, []);
    assert.deepEqual(fixture.callbacks, [false]);
    assert.false(fixture.component.get('saving'));
    destroyOwned(fixture.component);
  });
}

for (let editing of [true, false]) {
  test(`${editing ? 'ordinary edit' : 'create'} retains the generic save path`, async function(assert) {
    let fixture = setup({editing, upgradeImage: 'false', needsUpgrade: false});
    let calls = 0;
    run(() => fixture.service.set('save', () => { calls++; return resolve(fixture.service); }));
    await fixture.save();
    assert.equal(calls, 1);
    assert.deepEqual(fixture.requests, []);
    assert.deepEqual(fixture.callbacks, [true]);
    destroyOwned(fixture.component);
  });
}
