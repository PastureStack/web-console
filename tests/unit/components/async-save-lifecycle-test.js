import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { reject, resolve } from 'rsvp';
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
    intl: EmberObject.create({t(key) { return key; }}),
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

test('environment member permission failure uses the existing error block and releases saving', async function(assert) {
  let projectSaves = 0;
  let memberSaves = 0;
  let done = 0;
  let project = EmberObject.create({
    id: '1a21',
    actionLinks: {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers'},
    projectMembers: A([{externalIdType: 'oidc_user', externalId: 'user-1', role: 'owner'}]),
    validationErrors() { return A([]); },
    save() {
      projectSaves++;
      return resolve(this);
    },
    doAction(action) {
      assert.strictEqual(action, 'setmembers', 'the member action is the failing operation');
      memberSaves++;
      return reject({status: 403, message: 'Forbidden'});
    },
  });
  let component = createOwned(ViewEditProject, {
    access: EmberObject.create({enabled: true}),
    editing: true,
    growl: EmberObject.create(),
    intl: EmberObject.create({t(key) { return key; }}),
    network: null,
    project,
    projects: EmberObject.create({refreshAll() { assert.ok(false, 'failed save must not refresh'); }}),
    renderer: inertRenderer(),
    sendAction(name) { if ( name === 'done' ) { done++; } },
  }, 'component');
  let callbacks = [];

  let outcome = await invokeSave(component, (success) => callbacks.push(success));
  assert.strictEqual(outcome.saved, false, 'the complete save Promise reports failure');
  assert.strictEqual(projectSaves, 1, 'the project save is not repeated');
  assert.strictEqual(memberSaves, 1, 'the denied member action is not retried');
  assert.deepEqual(component.get('errors'), ['viewEditProject.error.membersNotSaved'], 'top-errors receives the translated permission message');
  assert.strictEqual(component.get('saving'), false, 'the save lock is released');
  assert.deepEqual(callbacks, [false], 'the completion callback fires once with failure');
  assert.strictEqual(done, 0, 'the edit form stays open');
  destroyOwned(component);
});

test('environment member server failure reports possible earlier settings save', async function(assert) {
  let project = EmberObject.create({
    id: '1a21',
    actionLinks: {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers'},
    projectMembers: A([{externalIdType: 'oidc_user', externalId: 'user-1', role: 'owner'}]),
    validationErrors() { return A([]); },
    save() { return resolve(this); },
    doAction() { return reject({status: 500, message: 'Internal error'}); },
  });
  let component = createOwned(ViewEditProject, {
    access: EmberObject.create({enabled: true}),
    editing: true,
    growl: EmberObject.create(),
    intl: EmberObject.create({t(key) { return key; }}),
    network: null,
    project,
    projects: EmberObject.create({refreshAll() { assert.ok(false, 'failed save must not refresh'); }}),
    renderer: inertRenderer(),
    sendAction() { assert.ok(false, 'failed save must not finish editing'); },
  }, 'component');
  let outcome = await invokeSave(component);
  assert.strictEqual(outcome.saved, false);
  assert.deepEqual(component.get('errors'), ['viewEditProject.error.membersFailed']);
  assert.strictEqual(component.get('saving'), false);
  destroyOwned(component);
});

test('environment project save distinguishes expired, denied, server, and validation failures', async function(assert) {
  for (let status of [401, 403, 404, 500, 422]) {
    let project = EmberObject.create({
      id: '1a21',
      actionLinks: {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers'},
      projectMembers: A([{externalIdType: 'oidc_user', externalId: 'user-1', role: 'owner'}]),
      validationErrors() { return A([]); },
      save() { return reject({status, message: 'Original server error'}); },
      doAction() { assert.ok(false, 'member action must not run after project save fails'); },
    });
    let component = createOwned(ViewEditProject, {
      access: EmberObject.create({enabled: true}),
      editing: true,
      growl: EmberObject.create(),
      intl: EmberObject.create({t(key) { return key; }}),
      network: null,
      project,
      projects: EmberObject.create({refreshAll() { assert.ok(false, 'failed save must not refresh'); }}),
      renderer: inertRenderer(),
      sendAction() { assert.ok(false, 'failed save must not finish editing'); },
    }, 'component');

    let outcome = await invokeSave(component);
    assert.strictEqual(outcome.saved, false, `HTTP ${status} reports failure`);
    let expected = status === 401 ? 'login.error.timedOut' :
      status === 403 || status === 404 ? 'viewEditProject.error.projectNotSaved' :
        status === 500 ? 'viewEditProject.error.projectFailed' : 'Original server error';
    assert.deepEqual(component.get('errors'), [expected], `HTTP ${status} shows the correct message`);
    assert.strictEqual(component.get('saving'), false, `HTTP ${status} releases the lock`);
    destroyOwned(component);
  }
});

test('environment network save failure reports partial success and leaves the form unlocked', async function(assert) {
  for (let status of [403, 404, 500]) {
    let projectSaves = 0;
    let memberSaves = 0;
    let project = EmberObject.create({
      id: '1a21',
      actionLinks: {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers'},
      projectMembers: A([{externalIdType: 'oidc_user', externalId: 'user-1', role: 'owner'}]),
      validationErrors() { return A([]); },
      save() { projectSaves++; return resolve(this); },
      doAction() { memberSaves++; return resolve(); },
    });
    let network = EmberObject.create({
      actionLinks: {update: '/networks/1n1'},
      policy: A([]),
      save() { return reject({status, message: 'Original network failure'}); },
    });
    let component = createOwned(ViewEditProject, {
      access: EmberObject.create({enabled: true}),
      editing: true,
      growl: EmberObject.create(),
      intl: EmberObject.create({t(key) { return key; }}),
      network,
      policyManager: EmberObject.create({id: '1st1'}),
      project,
      projects: EmberObject.create({refreshAll() { assert.ok(false, 'failed save must not refresh'); }}),
      renderer: inertRenderer(),
      sendAction() { assert.ok(false, 'failed save must not leave the form'); },
    }, 'component');

    let outcome = await invokeSave(component);
    let key = status === 500 ? 'networkFailed' : 'networkNotSaved';
    assert.strictEqual(outcome.saved, false, `HTTP ${status} reports incomplete save`);
    assert.deepEqual(component.get('errors'), [`viewEditProject.error.${key}`], `HTTP ${status} shows the correct partial-save message`);
    assert.strictEqual(projectSaves, 1, 'project settings saved once before the network failure');
    assert.strictEqual(memberSaves, 1, 'members saved once before the network failure');
    assert.strictEqual(component.get('saving'), false, 'the form is unlocked');
    destroyOwned(component);
  }
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
