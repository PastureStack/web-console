import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';

import ViewEditProject from 'ui/components/view-edit-project/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | view edit project permissions');

function makeComponent(project, network, options = {}) {
  return createOwned(ViewEditProject, {
    access: EmberObject.create({enabled: true}),
    editing: true,
    growl: EmberObject.create(),
    intl: EmberObject.create({t(key) { return key; }}),
    network,
    policyManager: EmberObject.create({id: '1st1'}),
    project,
    projects: EmberObject.create({refreshAll() {}}),
    renderer: inertRenderer(),
    sendAction() {},
    ...options,
  }, 'component');
}

test('existing environment writes only resources advertised by their own capabilities', async function(assert) {
  let cases = [
    {name: 'readonly', project: false, members: false, network: false},
    {name: 'metadata only', project: true, members: false, network: false},
    {name: 'members only', project: false, members: true, network: false},
    {name: 'network only', project: false, members: false, network: true},
    {name: 'owner', project: true, members: true, network: true},
  ];

  for (let permissions of cases) {
    let writes = {project: 0, members: 0, network: 0};
    let actionLinks = {};
    if ( permissions.project ) {
      actionLinks.update = '/projects/1a21';
    }
    if ( permissions.members ) {
      actionLinks.setmembers = '/projects/1a21?action=setmembers';
    }
    let project = EmberObject.create({
      actionLinks,
      id: '1a21',
      projectMembers: A([EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1', role: 'owner'})]),
      validationErrors() { return A([]); },
      save() { writes.project++; return resolve(this); },
      doAction(action) {
        assert.strictEqual(action, 'setmembers', `${permissions.name}: only the member action is used`);
        writes.members++;
        return resolve();
      },
    });
    let network = EmberObject.create({
      actionLinks: permissions.network ? {update: '/networks/1n1'} : {},
      policy: A([]),
      save(options) {
        assert.strictEqual(options.headers['X-Api-Project-Id'], '1a21');
        writes.network++;
        return resolve(this);
      },
    });
    let component = makeComponent(project, network);

    assert.strictEqual(component.get('canEditProject'), permissions.project, `${permissions.name}: metadata capability`);
    assert.strictEqual(component.get('canEditMembers'), permissions.members, `${permissions.name}: member capability`);
    assert.strictEqual(component.get('canEditNetwork'), permissions.network, `${permissions.name}: network capability`);
    assert.strictEqual(component.get('canSave'), permissions.project || permissions.members || permissions.network,
      `${permissions.name}: save availability`);

    let result = await component.get('actions').save.call(component);
    assert.deepEqual(writes, {
      project: Number(permissions.project),
      members: Number(permissions.members),
      network: Number(permissions.network),
    }, `${permissions.name}: persistence follows capabilities`);
    if ( !permissions.project && !permissions.members && !permissions.network ) {
      assert.deepEqual(result, {saved: false, reason: 'cancelled'}, 'a direct save cannot submit a readonly environment');
    }
    assert.strictEqual(component.get('saving'), false, `${permissions.name}: save lock is released`);
    destroyOwned(component);
  }
});

test('member actions cannot mutate a readonly membership list', function(assert) {
  let owner = EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1', role: 'owner'});
  let candidate = EmberObject.create({externalIdType: 'oidc_user', externalId: 'user-2'});
  let project = EmberObject.create({id: '1a21', actionLinks: {}, projectMembers: A([owner])});
  let component = makeComponent(project, null);

  component.send('checkMember', candidate);
  component.send('removeMember', owner);
  assert.deepEqual(project.get('projectMembers').toArray(), [owner], 'direct actions leave the list unchanged');

  project.set('actionLinks', {setmembers: '/projects/1a21?action=setmembers'});
  assert.true(component.get('canEditMembers'), 'the link enables member editing without checking a role name');
  component.send('checkMember', candidate);
  assert.strictEqual(candidate.get('role'), 'member', 'the existing owner keeps new members from becoming owners');
  assert.strictEqual(project.get('projectMembers').get('length'), 2);
  component.send('removeMember', candidate);
  assert.deepEqual(project.get('projectMembers').toArray(), [owner]);
  destroyOwned(component);
});

test('member validation errors use translated messages', function(assert) {
  let owner = EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1', role: 'owner'});
  let project = EmberObject.create({
    id: '1a21',
    actionLinks: {setmembers: '/projects/1a21?action=setmembers'},
    projectMembers: A([owner]),
    validationErrors() { return A([]); },
  });
  let component = makeComponent(project, null);
  let duplicate = EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1'});

  component.send('checkMember', duplicate);
  assert.deepEqual(component.get('errors'), ['viewEditProject.error.memberAlreadyListed']);

  component.send('removeMember', owner);
  assert.false(component.validate());
  assert.deepEqual(component.get('errors'), ['viewEditProject.error.ownerRequired']);
  destroyOwned(component);
});

test('new environment still saves its initial members in the project request', async function(assert) {
  let owner = EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1', role: 'owner'});
  let project = EmberObject.create({
    actionLinks: {},
    id: null,
    projectMembers: A([owner]),
    validationErrors() { return A([]); },
    save() {
      assert.strictEqual(this.get('members'), this.get('projectMembers'), 'initial members are sent with create');
      return resolve(this);
    },
    doAction() { assert.ok(false, 'new environments do not call setmembers'); },
  });
  let component = makeComponent(project, null, {editing: false});

  assert.true(component.get('canEditProject'));
  assert.true(component.get('canEditMembers'));
  assert.true(component.get('canSave'));
  await component.get('actions').save.call(component);
  assert.strictEqual(component.get('saving'), false);
  destroyOwned(component);
});

test('network policy requires an editable network and a visible supported editor', function(assert) {
  let project = EmberObject.create({id: '1a21', actionLinks: {}, projectMembers: A([])});
  let network = EmberObject.create({actionLinks: {update: '/networks/1n1'}, policy: A([])});
  let component = makeComponent(project, network, {access: EmberObject.create({enabled: false})});

  assert.true(component.get('canEditNetwork'));
  component.set('policyManager', null);
  assert.false(component.get('canEditNetwork'), 'missing policy manager hides the editor');
  assert.false(component.get('canSave'), 'an invisible editor does not leave a save button');
  component.set('policyManager', EmberObject.create({id: '1st1'}));
  network.set('policy', A([EmberObject.create({within: null})]));
  assert.false(component.get('canEditNetwork'), 'unsupported policy cannot be edited by this form');
  assert.false(component.get('canSave'));
  destroyOwned(component);
});
