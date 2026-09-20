import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';

import NewBalancer from 'ui/components/new-balancer/component';
import ViewEditProject from 'ui/components/view-edit-project/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | async save lifecycle');

function invokeSave(component, callback) {
  return component.get('actions').save.call(component, callback);
}

test('environment edit can save, finish, and cancel without leaving its lock active', async function(assert) {
  let saves = 0;
  let refreshes = 0;
  let done = 0;
  let cancelled = 0;
  let project = EmberObject.create({
    actionLinks: {update: '/projects/1a21'},
    id: '1a21',
    projectMembers: A([]),
    validationErrors() {
      return A([]);
    },
    save() {
      saves++;
      return resolve(this);
    },
  });
  let component = createOwned(ViewEditProject, {
    access: EmberObject.create({enabled: false}),
    editing: true,
    growl: EmberObject.create(),
    network: null,
    project,
    projects: EmberObject.create({
      refreshAll() {
        refreshes++;
      },
    }),
    renderer: inertRenderer(),
    sendAction(name) {
      if ( name === 'done' ) {
        done++;
      } else if ( name === 'cancel' ) {
        cancelled++;
      }
    },
  }, 'component');
  let callbacks = [];

  let result = await invokeSave(component, (success) => callbacks.push(success));
  assert.strictEqual(result, project, 'the full save Promise resolves to the saved project');
  assert.strictEqual(saves, 1, 'the environment is persisted once');
  assert.strictEqual(refreshes, 1, 'the environment collection refreshes once');
  assert.strictEqual(done, 1, 'the completed edit exits once');
  assert.deepEqual(callbacks, [true], 'the completion callback reports success once');
  assert.strictEqual(component.get('saving'), false, 'the environment lock is released');

  component.get('actions').cancel.call(component);
  assert.strictEqual(cancelled, 1, 'cancel exits once');
  assert.strictEqual(saves, 1, 'cancel does not persist another update');
  destroyOwned(component);
});

test('load balancer edit uses the shared lifecycle and resolves after persistence', async function(assert) {
  let saves = 0;
  let done = 0;
  let callbacks = [];
  let portRule = EmberObject.create({
    access: 'public',
    ipProtocol: 'http',
    isSelector: false,
    protocol: 'http',
    serviceId: '1s-target',
    sourceIp: null,
    sourcePort: 80,
    targetPort: 8080,
    weight: null,
  });
  let launchConfig = EmberObject.create({
    expose: A([]),
    labels: {},
    ports: A([]),
  });
  let service = EmberObject.create({
    id: '1s-balancer',
    launchConfig,
    lbConfig: EmberObject.create({
      certificateIds: A([]),
      defaultCertificateId: null,
      needsCertificate: false,
      portRules: A([portRule]),
    }),
    initPorts() {},
    save() {
      saves++;
      return resolve(this);
    },
    validationErrors() {
      return A([]);
    },
  });
  let component = createOwned(NewBalancer, {
    editing: true,
    existing: EmberObject.create({launchConfig: EmberObject.create({labels: {}})}),
    intl: EmberObject.create({
      t(key) {
        return key;
      },
    }),
    renderer: inertRenderer(),
    service,
    settings: EmberObject.create(),
    sendAction(name) {
      if ( name === 'done' ) {
        done++;
      }
    },
  }, 'component');

  let result = await invokeSave(component, (success) => callbacks.push(success));
  assert.strictEqual(result, undefined, 'the lifecycle resolves only after the balancer edit chain completes');
  assert.strictEqual(saves, 1, 'the edited balancer is persisted once');
  assert.strictEqual(done, 1, 'the edit completion action runs once');
  assert.deepEqual(callbacks, [true], 'the completion callback reports success once');
  assert.strictEqual(component.get('saving'), false, 'the balancer lock is released');
  destroyOwned(component);
});
