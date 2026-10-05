import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import ProjectDetailRoute from 'ui/settings/projects/detail/route';

module('Unit | Route | settings projects detail');

function fixture(failureAt, failure = new Error(`${failureAt} failed`)) {
  let relatedCalls = [];
  let members = A([EmberObject.create({id: '1pm1', role: 'owner'})]);
  let project = EmberObject.create({
    id: '1a21',
    name: 'QA project',
    state: 'active',
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
        state: this.get('state'),
        actionLinks: this.get('actionLinks'),
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
        relatedCalls.push(type);
        this.set('networkOptions', opt);
        return failureAt === 'networks' ? reject(failure) : resolve(A([]));
      }
      if ( type === 'stack' ) {
        relatedCalls.push(type);
        if ( failureAt === 'policyManagers' ) {
          return reject(failure);
        }
        this.set('policyManagerOptions', opt);
        return resolve(A([policyManager]));
      }
      return reject(new Error(`unexpected find ${type}:${id}`));
    },
  });

  return {failure, members, policyManager, project, store, relatedCalls};
}

for (let editing of [false, true]) {
  test(`inactive environment ${editing ? 'edit' : 'view'} preserves global data without scoped resource reads`, async function(assert) {
    let data = fixture();
    let actionLinks = {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers', remove: '/projects/1a21'};
    data.project.setProperties({state: 'inactive', actionLinks});
    let route = ProjectDetailRoute.create({userStore: data.store});

    try {
      let model = await route.model({project_id: '1a21', editing});
      assert.deepEqual(data.relatedCalls, [], 'neither network nor policy-manager API is requested');
      assert.strictEqual(model.get('network'), null, 'network data is unavailable, not an empty collection');
      assert.strictEqual(model.get('policyManager'), null, 'no policy manager is invented');
      assert.true(model.get('networkUnavailableForInactiveProject'), 'the model exposes the exact state reason');
      assert.strictEqual(model.get('all').objectAt(0), data.project, 'the global project list is retained');
      assert.strictEqual(model.get('project.projectMembers'), data.members, 'authorized global memberships are retained');
      assert.strictEqual(model.get('project.actionLinks'), actionLinks, 'the API remains the source of metadata, member, and remove capabilities');
      assert.strictEqual(model.get('originalProject'), editing ? data.project : null);
      assert.strictEqual(model.get('project') === data.project, !editing, 'only the edit form clones the project');
    } finally {
      run(() => route.destroy());
    }
  });
}

test('inactive global project and member failures remain errors before any scoped reads', async function(assert) {
  let intl = EmberObject.create({t(key) { return key; }});
  for (let task of ['allProjects', 'project', 'members']) {
    for (let status of [401, 403, 404, 503]) {
      let failure = {status, message: 'Raw API message'};
      let data = fixture(task, failure);
      data.project.set('state', 'inactive');
      let route = ProjectDetailRoute.create({userStore: data.store, intl});

      try {
        await route.model({project_id: '1a21', editing: false}).then(
          () => assert.ok(false, `${task} ${status} must reject`),
          (error) => {
            assert.strictEqual(error.status, status === 403 || status === 404 ? 404 : status,
              `${task} ${status} keeps the established error classification`);
            if ( status === 401 ) {
              assert.strictEqual(error, failure, 'expired-session handling is unchanged');
            }
          }
        );
        assert.deepEqual(data.relatedCalls, [], `${task} ${status} cannot start scoped reads`);
      } finally {
        run(() => route.destroy());
      }
    }
  }
});

test('only exact inactive skips scoped reads; other states still reject related 403s', async function(assert) {
  let intl = EmberObject.create({t(key) { return key; }});
  for (let state of ['active', 'deactivating', 'activating', 'removed', 'upgrading', 'updating-active', 'unknown', null, undefined]) {
    for (let task of ['networks', 'policyManagers']) {
      let data = fixture(task, {status: 403, message: 'Forbidden'});
      data.project.set('state', state);
      let route = ProjectDetailRoute.create({userStore: data.store, intl});

      try {
        await route.model({project_id: '1a21', editing: false}).then(
          () => assert.ok(false, `${state} ${task} 403 must reject`),
          (error) => {
            assert.strictEqual(error.status, 404, 'the existing denied-resource error is preserved');
            assert.strictEqual(error.messageKey, 'viewEditProject.error.relatedUnavailable');
          }
        );
        assert.ok(data.relatedCalls.includes(task === 'networks' ? 'network' : 'stack'), 'the applicable request is still sent');
        assert.strictEqual(data.project.get('projectMembers'), data.members, 'global members were loaded first');
      } finally {
        run(() => route.destroy());
      }
    }
  }
});

test('a denied project cannot start unrelated network or policy-manager reads', async function(assert) {
  let data = fixture('project', {status: 404, message: 'Environment unavailable'});
  let route = ProjectDetailRoute.create({userStore: data.store, intl: EmberObject.create({
    t() { return 'Environment unavailable'; },
  })});

  await route.model({project_id: 'forbidden-project', editing: false}).then(
    () => assert.ok(false, 'the denied environment must not load'),
    (error) => assert.strictEqual(error.status, 404)
  );
  assert.deepEqual(data.relatedCalls, [], 'no network or stack API request is sent');
  run(() => route.destroy());
});

test('loads project members through the supported link contract before cloning for edit', function(assert) {
  let data = fixture();
  let route = ProjectDetailRoute.create({userStore: data.store});

  return route.model({project_id: '1a21', editing: true}).then((model) => {
    assert.strictEqual(model.get('originalProject'), data.project, 'the stored project is retained');
    assert.notStrictEqual(model.get('project'), data.project, 'editing uses a clone');
    assert.strictEqual(model.get('project.projectMembers'), data.members, 'the imported members reach the editable clone');
    assert.strictEqual(model.get('policyManager'), data.policyManager, 'the policy manager is loaded');
    assert.false(model.get('networkUnavailableForInactiveProject'), 'an active environment has no inactive notice');
    assert.deepEqual(data.relatedCalls, ['network', 'stack'], 'both active-environment reads still run');
    assert.strictEqual(data.store.get('networkOptions.filter.accountId'), '1a21', 'the network lookup stays in the selected project');
    assert.strictEqual(data.store.get('networkOptions.headers.X-Api-Project-Id'), '1a21', 'the network lookup uses its project policy');
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

test('environment load errors distinguish access, server failures, and expired sessions', async function(assert) {
  const translations = {
    'viewEditProject.error.projectUnavailable': 'Environment unavailable',
    'viewEditProject.error.membersUnavailable': 'Members unavailable',
    'viewEditProject.error.relatedUnavailable': 'Environment data unavailable',
    'viewEditProject.error.loadFailed': 'Server temporarily unavailable',
  };
  const intl = EmberObject.create({t(key) { return translations[key]; }});

  for (let [task, status, expected] of [
    ['project', 403, 'Environment unavailable'],
    ['project', 404, 'Environment unavailable'],
    ['members', 403, 'Members unavailable'],
    ['members', 404, 'Members unavailable'],
    ['allProjects', 403, 'Environment data unavailable'],
    ['networks', 403, 'Environment data unavailable'],
    ['policyManagers', 404, 'Environment data unavailable'],
  ]) {
    let data = fixture(task, {status, message: 'Raw API message'});
    let route = ProjectDetailRoute.create({userStore: data.store, intl});
    await route.model({project_id: '1a21', editing: false}).then(
      () => assert.ok(false, `${task} ${status} must reject`),
      (err) => {
        assert.strictEqual(err.status, 404, 'denied and missing resources have the same visible status');
        assert.strictEqual(err.message, expected, 'the existing error view receives a human message');
        assert.strictEqual(err.messageKey, task === 'project' ? 'viewEditProject.error.projectUnavailable' :
          task === 'members' ? 'viewEditProject.error.membersUnavailable' : 'viewEditProject.error.relatedUnavailable',
        'the error view can retranslate the message after a locale change');
        assert.notOk(err.detail, 'the API does not disclose extra details');
      }
    );
    run(() => route.destroy());
  }

  for (let [task, status] of [['project', 500], ['members', 500], ['networks', 503], ['policyManagers', 500]]) {
    let data = fixture(task, {status, message: 'QA simulated raw server error'});
    let route = ProjectDetailRoute.create({userStore: data.store, intl});
    await route.model({project_id: '1a21', editing: false}).then(
      () => assert.ok(false, `${task} ${status} must reject`),
      (err) => {
        assert.strictEqual(err.status, status, 'the real server failure status is retained');
        assert.strictEqual(err.message, 'Server temporarily unavailable', 'the raw API error is not shown');
        assert.strictEqual(err.messageKey, 'viewEditProject.error.loadFailed');
      }
    );
    run(() => route.destroy());
  }

  for (let [task, status] of [['members', 401], ['networks', 400]]) {
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
