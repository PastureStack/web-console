import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import ProjectDetailRoute from 'ui/settings/projects/detail/route';

module('Unit | Route | settings projects detail');

function fixture(failureAt, failure = new Error(`${failureAt} failed`)) {
  let members = A([EmberObject.create({id: '1pm1', role: 'owner'})]);
  let project = EmberObject.create({
    id: '1a21',
    name: 'QA project',
    projectMembers: null,
    followLink(name) {
      if ( failureAt === 'membersSync' ) {
        throw failure;
      }
      if ( failureAt === 'members' ) {
        return reject(failure);
      }
      if ( name !== 'projectMembers' ) {
        return reject(new Error(`unexpected link ${name}`));
      }
      return resolve(members);
    },
    clone() {
      return EmberObject.create({
        id: this.get('id'),
        name: this.get('name'),
        projectMembers: this.get('projectMembers'),
      });
    },
  });
  let policyManager = EmberObject.create({id: '1st1'});
  let store = EmberObject.create({
    findAll(type) {
      if ( failureAt === 'allProjects' ) {
        return reject(failure);
      }
      return resolve(A(type === 'project' ? [project] : []));
    },
    find(type, id, opt) {
      if ( type === 'project' ) {
        return failureAt === 'project' ? reject(failure) : resolve(project);
      }
      if ( type === 'network' ) {
        return failureAt === 'networks' ? reject(failure) : resolve(A([]));
      }
      if ( type === 'stack' ) {
        if ( failureAt === 'policyManagers' ) {
          return reject(failure);
        }
        this.set('policyManagerOptions', opt);
        return resolve(A([policyManager]));
      }
      return reject(new Error(`unexpected find ${type}:${id}`));
    },
  });

  return {failure, members, policyManager, project, store};
}

test('loads project members through the supported link contract before cloning for edit', function(assert) {
  let data = fixture();
  let route = ProjectDetailRoute.create({userStore: data.store});

  return route.model({project_id: '1a21', editing: true}).then((model) => {
    assert.strictEqual(model.get('originalProject'), data.project, 'the stored project is retained');
    assert.notStrictEqual(model.get('project'), data.project, 'editing uses a clone');
    assert.strictEqual(model.get('project.projectMembers'), data.members, 'the imported members reach the editable clone');
    assert.strictEqual(model.get('policyManager'), data.policyManager, 'the policy manager is loaded');
    assert.strictEqual(data.store.get('policyManagerOptions.headers.X-Api-Project-Id'), '1a21', 'policy manager lookup is scoped to the project');
    run(() => route.destroy());
  });
});

test('every environment loading task rejects with its original failure instead of hanging', async function(assert) {
  let failurePoints = ['allProjects', 'project', 'members', 'membersSync', 'networks', 'policyManagers'];

  assert.expect(failurePoints.length);
  for (let failureAt of failurePoints) {
    let data = fixture(failureAt);
    let route = ProjectDetailRoute.create({userStore: data.store});

    await route.model({project_id: '1a21', editing: false}).then(
      () => assert.ok(false, `${failureAt} must reject`),
      (err) => assert.strictEqual(err, data.failure, `${failureAt} retains the original failure`)
    );
    run(() => route.destroy());
  }
});

test('project and member-link access errors show a safe message without hiding unrelated failures', async function(assert) {
  const translations = {
    'viewEditProject.error.projectUnavailable': 'Environment unavailable',
    'viewEditProject.error.membersUnavailable': 'Members unavailable',
  };
  const intl = EmberObject.create({t(key) { return translations[key]; }});

  for (let [task, status, expected] of [
    ['project', 403, 'Environment unavailable'],
    ['project', 404, 'Environment unavailable'],
    ['members', 403, 'Members unavailable'],
    ['members', 404, 'Members unavailable'],
  ]) {
    let data = fixture(task, {status, message: 'Raw API message'});
    let route = ProjectDetailRoute.create({userStore: data.store, intl});
    await route.model({project_id: '1a21', editing: false}).then(
      () => assert.ok(false, `${task} ${status} must reject`),
      (err) => {
        assert.strictEqual(err.status, 404, 'denied and missing resources have the same visible status');
        assert.strictEqual(err.message, expected, 'the existing error view receives a human message');
        assert.notOk(err.detail, 'the API does not disclose extra details');
      }
    );
    run(() => route.destroy());
  }

  for (let [task, status] of [['members', 401], ['members', 500], ['networks', 403]]) {
    let failure = {status, message: 'Original failure'};
    let data = fixture(task, failure);
    let route = ProjectDetailRoute.create({userStore: data.store, intl});
    await route.model({project_id: '1a21', editing: false}).then(
      () => assert.ok(false, `${task} ${status} must reject`),
      (err) => assert.strictEqual(err, failure, `${task} ${status} keeps its normal error handling`)
    );
    run(() => route.destroy());
  }
});
