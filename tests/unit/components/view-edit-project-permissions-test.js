import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';

import ViewEditProject from 'ui/components/view-edit-project/component';
import ProjectTemplate from 'ui/models/projecttemplate';
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

test('native project template choices use names, keep IDs, and react to renames', function(assert) {
  let app = EmberObject.create({baseAssets: '/'});
  let zulu = ProjectTemplate.create({id: '1pt-zulu', name: 'Zulu environment', stacks: A([]), app});
  let alpha = ProjectTemplate.create({id: '1pt-alpha', name: 'alpha environment', stacks: A([]), app});
  let project = EmberObject.create({id: null, projectTemplateId: zulu.id, projectMembers: A([])});
  let component = makeComponent(project, null, {app, editing: false, projectTemplates: A([zulu, alpha])});

  try {
    assert.strictEqual(zulu.get('localizedName'), undefined, 'the real native model has no catalog localizedName');
    assert.strictEqual(alpha.get('localizedName'), undefined, 'no fixture alias hides a missing native name');
    assert.deepEqual(component.get('templateChoices').map(({id, name, image}) => ({id, name, image})), [
      {id: alpha.id, name: 'alpha environment', image: alpha.get('orchestrationIcon')},
      {id: zulu.id, name: 'Zulu environment', image: zulu.get('orchestrationIcon')},
    ], 'user-defined names are sorted case-insensitively without losing IDs or icons');

    component.send('selectTemplate', alpha.id);
    assert.strictEqual(project.get('projectTemplateId'), alpha.id, 'the action stores the selected native ID, not its name');
    assert.strictEqual(component.get('selectedProjectTemplate'), alpha, 'the selection resolves the actual native model');

    alpha.set('name', 'zz renamed environment');
    assert.deepEqual(component.get('templateChoices').map(({id, name}) => ({id, name})), [
      {id: zulu.id, name: 'Zulu environment'},
      {id: alpha.id, name: 'zz renamed environment'},
    ], 'the existing name dependency refreshes both labels and order');
    assert.strictEqual(project.get('projectTemplateId'), alpha.id, 'renaming does not replace the selected ID');
  } finally {
    destroyOwned(component);
    destroyOwned(zulu);
    destroyOwned(alpha);
  }
});

test('an empty native project template list keeps the None choice', function(assert) {
  let project = EmberObject.create({id: null, projectTemplateId: '1pt-stale', projectMembers: A([])});
  let component = makeComponent(project, null, {
    app: EmberObject.create({baseAssets: '/'}),
    editing: false,
    projectTemplates: A([]),
  });

  try {
    let choices = component.get('templateChoices');
    assert.strictEqual(choices.length, 1);
    assert.deepEqual({id: choices[0].id, name: choices[0].name, image: choices[0].image}, {
      id: null,
      name: 'None',
      image: '/assets/images/logos/pasturestack-mark.svg',
    }, 'the no-template fallback remains a null-ID native choice');
    component.send('selectTemplate', choices[0].id);
    assert.strictEqual(project.get('projectTemplateId'), null, 'the fallback clears a stale template ID');
    assert.strictEqual(component.get('selectedProjectTemplate'), undefined);
  } finally {
    destroyOwned(component);
  }
});

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

test('inactive network unavailability preserves global capabilities and prevents stale network saves', async function(assert) {
  for (let canEdit of [false, true]) {
    let writes = {project: 0, members: 0, network: 0};
    let actionLinks = canEdit ? {update: '/projects/1a21', setmembers: '/projects/1a21?action=setmembers', remove: '/projects/1a21'} : {};
    let project = EmberObject.create({
      id: '1a21', state: 'inactive', actionLinks,
      projectMembers: A([EmberObject.create({externalIdType: 'oidc_user', externalId: 'owner-1', role: 'owner'})]),
      validationErrors() { return A([]); },
      save() { writes.project++; return resolve(this); },
      doAction(action) { assert.strictEqual(action, 'setmembers'); writes.members++; return resolve(); },
    });
    let network = EmberObject.create({
      actionLinks: {update: '/networks/1n1'}, policy: A([]),
      save() { writes.network++; return resolve(this); },
    });
    let component = makeComponent(project, network, {networkUnavailableForInactiveProject: true});

    try {
      assert.strictEqual(component.get('canEditProject'), canEdit, 'metadata still follows the global project link');
      assert.strictEqual(component.get('canEditMembers'), canEdit, 'members still follow the global setmembers link');
      assert.false(component.get('canEditNetwork'), 'even a stale editable network cannot enable scoped persistence');
      assert.strictEqual(component.get('canSave'), canEdit, 'the notice does not grant a save capability');
      await component.get('actions').save.call(component);
      assert.deepEqual(writes, {project: Number(canEdit), members: Number(canEdit), network: 0}, 'only the advertised global operations are saved');
      assert.strictEqual(project.get('actionLinks'), actionLinks, 'remove and other action links are not rewritten');
    } finally {
      destroyOwned(component);
    }
  }
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
