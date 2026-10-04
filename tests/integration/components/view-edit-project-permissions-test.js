import { A } from '@ember/array';
import Component from '@ember/component';
import EmberObject, { get } from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, findAll, render, select, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import ProjectTemplate from 'ui/models/projecttemplate';
import Router from 'ui/router';
import { destroyOwned } from '../../helpers/owned-subject';
import resolver from '../../helpers/resolver';

module('Integration | Component | view edit project permissions', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    this.owner.register('service:access', Service.extend({enabled: true}));
    this.owner.register('service:projects', Service.extend({}));
    this.owner.register('service:growl', Service.extend({}));
    this.owner.register('service:intl', Service.extend({t(key) { return key; }}));
    this.owner.register('component:input-identity', Component.extend({
      layout: precompileTemplate('<div data-test-member-add></div>'),
    }));
    this.owner.register('component:identity-block', Component.extend({
      layout: precompileTemplate('<span data-test-member-name>{{this.identity.name}}</span>'),
    }));
    await setupRenderingContext(this);

    let owner = EmberObject.create({
      displayType: 'User',
      externalId: 'owner-1',
      externalIdType: 'oidc_user',
      name: 'Owner',
      role: 'owner',
    });
    this.project = EmberObject.create({
      actionLinks: {},
      description: 'Description',
      id: '1a21',
      name: 'Environment',
      projectMembers: A([owner]),
    });
    this.network = EmberObject.create({
      actionLinks: {},
      defaultPolicyAction: 'allow',
      policy: A(['linked', 'service', 'stack'].map((within) => EmberObject.create({within, action: 'allow'}))),
    });
    this.originalProject = EmberObject.create({displayName: 'Environment'});
    this.policyManager = EmberObject.create({id: '1st1'});
    this.userStore = {
      getById(type, id) {
        if ( type === 'schema' && id === 'projectmember' ) {
          return EmberObject.create({resourceFields: {role: {options: ['owner', 'member']}}});
        }
      },
    };
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    (this.nativeTemplates || []).forEach((template) => destroyOwned(template));
    this.testRoot.remove();
  });

  for (let memberType of ['plain object', 'EmberObject']) {
    test(`native role select updates the selected ${memberType} without metadata or network writes`, async function(assert) {
      let attributes = {
        displayType: 'User', externalId: 'member-2', externalIdType: 'oidc_user',
        name: 'Alpha Member', role: 'member',
      };
      let member = memberType === 'plain object' ? {...attributes} : EmberObject.create(attributes);
      let owner = {displayType: 'User', externalId: 'owner-1', externalIdType: 'oidc_user', name: 'Zulu Owner', role: 'owner'};
      let writes = {project: 0, members: [], network: 0, refresh: 0, done: 0};
      this.project.setProperties({
        actionLinks: {setmembers: '/projects/1a21?action=setmembers'},
        projectMembers: A([owner, member]),
        validationErrors() { return A([]); },
        save() { writes.project++; return Promise.resolve(this); },
        doAction(action, payload) {
          assert.strictEqual(action, 'setmembers', 'the native save submits only memberships');
          writes.members.push(payload);
          return Promise.resolve();
        },
      });
      this.network.set('save', () => { writes.network++; return Promise.resolve(); });
      this.owner.lookup('service:projects').set('refreshAll', () => { writes.refresh++; });
      this.done = () => { writes.done++; };
      this.userStore = {getById() { return EmberObject.create({resourceFields: {role: {options: ['owner', 'member', 'readonly']}}}); }};

      await render(precompileTemplate(`{{view-edit-project
        project=this.project originalProject=this.originalProject network=this.network
        policyManager=this.policyManager userStore=this.userStore showEdit=true editing=true done=this.done
      }}`));

      let rows = findAll('table.grid tbody tr');
      let selectedRow = rows.find((row) => row.querySelector('[data-test-member-name]').textContent.trim() === attributes.name);
      let roleSelect = selectedRow.querySelector('select');
      assert.strictEqual(rows[0], selectedRow, 'sorting selects the member rather than its original array index');
      assert.strictEqual(roleSelect.value, 'member');
      await select(roleSelect, 'readonly');
      assert.strictEqual(get(member, 'role'), 'readonly', 'input/change writes the real selected model');
      assert.strictEqual(this.project.get('projectMembers')[1], member, 'the arranged row retains its original model reference');
      assert.deepEqual({externalId: get(member, 'externalId'), externalIdType: get(member, 'externalIdType'), name: get(member, 'name')},
        {externalId: attributes.externalId, externalIdType: attributes.externalIdType, name: attributes.name}, 'identity and label are unchanged');
      assert.strictEqual(owner.role, 'owner', 'the owner row is not changed');
      assert.strictEqual(this.project.get('description'), 'Description', 'role selection does not change metadata');
      assert.true(find('input[type="text"]').disabled, 'members-only capability does not unlock metadata');
      assert.strictEqual(findAll('.radio input').length, 0, 'members-only capability does not unlock network policy');
      assert.deepEqual(writes.members, [], 'selecting alone sends no save');

      await click('.footer-actions .btn-primary');
      assert.deepEqual(writes.members, [{members: [
        {type: 'projectMember', externalId: owner.externalId, externalIdType: owner.externalIdType, role: 'owner'},
        {type: 'projectMember', externalId: attributes.externalId, externalIdType: attributes.externalIdType, role: 'readonly'},
      ]}], 'native save sends the selected role with exact original identities');
      assert.deepEqual({project: writes.project, network: writes.network, refresh: writes.refresh, done: writes.done},
        {project: 0, network: 0, refresh: 1, done: 1}, 'save capability and finalizer remain scoped to memberships');
      assert.strictEqual(owner.role, 'owner');
    });
  }

  test('new environment cards render real native names and select the same ID after a rename', async function(assert) {
    this.app = EmberObject.create({baseAssets: '/'});
    let zulu = ProjectTemplate.create({id: '1pt-zulu', name: 'Zulu environment', stacks: A([]), app: this.app});
    let alpha = ProjectTemplate.create({id: '1pt-alpha', name: 'alpha environment', stacks: A([]), app: this.app});
    this.nativeTemplates = [zulu, alpha];
    this.projectTemplates = A(this.nativeTemplates);
    this.project.setProperties({id: null, projectTemplateId: zulu.id});
    assert.strictEqual(alpha.get('localizedName'), undefined, 'the real native model supplies no catalog name alias');

    await render(precompileTemplate(`{{view-edit-project
      project=this.project originalProject=this.originalProject projectTemplates=this.projectTemplates
      app=this.app network=this.network policyManager=this.policyManager userStore=this.userStore
      showEdit=true editing=false
    }}`));

    assert.deepEqual(findAll('.orchestration-driver .clip').map((label) => label.textContent.trim()),
      ['alpha environment', 'Zulu environment'], 'native user-defined labels render in case-insensitive order');
    assert.strictEqual(findAll('.orchestration-driver.active').length, 1, 'one native ID is selected');
    assert.strictEqual(find('.orchestration-driver.active .clip').textContent.trim(), 'Zulu environment');

    await click(findAll('.orchestration-driver')[0]);
    assert.strictEqual(this.project.get('projectTemplateId'), alpha.id, 'the real card action stores its exact model ID');
    assert.strictEqual(find('.orchestration-driver.active .clip').textContent.trim(), 'alpha environment');

    alpha.set('name', 'zz renamed environment');
    await settled();
    assert.deepEqual(findAll('.orchestration-driver .clip').map((label) => label.textContent.trim()),
      ['Zulu environment', 'zz renamed environment'], 'renaming updates the rendered label and card order');
    assert.strictEqual(this.project.get('projectTemplateId'), alpha.id, 'the selected ID survives reordering');
    assert.strictEqual(findAll('.orchestration-driver.active').length, 1);
    assert.strictEqual(find('.orchestration-driver.active .clip').textContent.trim(), 'zz renamed environment');
  });

  test('new environment renders and selects the None card for an empty native template list', async function(assert) {
    this.app = EmberObject.create({baseAssets: '/'});
    this.projectTemplates = A([]);
    this.project.setProperties({id: null, projectTemplateId: '1pt-stale'});

    await render(precompileTemplate(`{{view-edit-project
      project=this.project originalProject=this.originalProject projectTemplates=this.projectTemplates
      app=this.app network=this.network policyManager=this.policyManager userStore=this.userStore
      showEdit=true editing=false
    }}`));

    assert.strictEqual(findAll('.orchestration-driver').length, 1);
    assert.strictEqual(find('.orchestration-driver .clip').textContent.trim(), 'None');
    assert.strictEqual(find('.orchestration-driver img').getAttribute('src'), '/assets/images/logos/pasturestack-mark.svg');
    assert.strictEqual(findAll('.orchestration-driver.active').length, 0, 'a stale ID is not selected');
    assert.ok(find('.well .text-center').textContent.includes('viewEditProject.nativeEngine'), 'the empty-list summary stays native');

    await click('.orchestration-driver');
    assert.strictEqual(this.project.get('projectTemplateId'), null, 'the native fallback action clears the stale ID');
    assert.strictEqual(findAll('.orchestration-driver.active').length, 1, 'the null-ID card becomes selected');
  });

  test('direct edit URL follows member, metadata, and network links independently', async function(assert) {
    let cancelled = 0;
    this.cancel = () => { cancelled++; };
    await render(precompileTemplate(`{{view-edit-project
      project=this.project originalProject=this.originalProject network=this.network
      policyManager=this.policyManager userStore=this.userStore showEdit=true editing=true cancel=this.cancel
    }}`));

    assert.ok(find('[data-test-member-name]'), 'the existing member stays visible');
    assert.notOk(find('[data-test-member-add]'), 'readonly cannot add a member');
    assert.strictEqual(findAll('table.grid select').length, 0, 'readonly cannot change a member role');
    assert.strictEqual(findAll('table.grid .gh-action').length, 0, 'readonly cannot remove a member');
    assert.strictEqual(findAll('.radio input').length, 0, 'readonly cannot edit network policy');
    assert.true(find('input[type="text"]').disabled, 'readonly cannot edit project metadata');
    assert.ok(find('.icon-alert'), 'the existing error block remains mounted in readonly mode');
    assert.strictEqual(findAll('.footer-actions button').length, 1, 'readonly has an exit action');
    assert.ok(find('.footer-actions button').textContent.includes('saveCancel.cancel'));
    await click('.footer-actions button');
    assert.strictEqual(cancelled, 1, 'the readonly exit action reaches the route callback');

    this.project.set('actionLinks', {setmembers: '/projects/1a21?action=setmembers'});
    await settled();
    assert.ok(find('[data-test-member-add]'), 'member capability exposes the add control');
    assert.strictEqual(findAll('table.grid select').length, 1, 'member capability exposes role selection');
    assert.strictEqual(findAll('table.grid .gh-action').length, 1, 'member capability exposes removal');
    assert.true(find('input[type="text"]').disabled, 'member capability does not unlock metadata');
    assert.strictEqual(findAll('.radio input').length, 0, 'member capability does not unlock the network');
    assert.strictEqual(findAll('.footer-actions button').length, 2, 'member capability exposes save and cancel');

    this.project.set('actionLinks', {update: '/projects/1a21'});
    this.network.set('actionLinks', {update: '/networks/1n1'});
    await settled();
    assert.notOk(find('[data-test-member-add]'), 'metadata and network links do not unlock member editing');
    assert.strictEqual(findAll('table.grid select').length, 0);
    assert.false(find('input[type="text"]').disabled, 'metadata link unlocks project fields');
    assert.ok(findAll('.radio input').length > 0, 'network link unlocks its policy controls');
    assert.strictEqual(findAll('.footer-actions button').length, 2);
  });

  test('network-only environment can reach its edit form from the detail header', async function(assert) {
    this.owner.register('router:main', Router);
    this.owner.register('component:action-menu', Component.extend({
      layout: precompileTemplate('<span data-test-action-menu></span>'),
    }));
    this.owner.register('component:header-state', Component.extend({
      layout: precompileTemplate('<span></span>'),
    }));
    this.owner.register('component:power-select', Component.extend({
      layout: precompileTemplate('<span></span>'),
    }));
    this.allProjects = A([this.project]);
    this.network.set('actionLinks', {update: '/networks/1n1'});
    this.owner.lookup('router:main').setupRouter();
    let routeTarget = this.owner.lookup('service:router').urlFor('settings.projects.detail', '1a21', {
      queryParams: {editing: true},
    });
    assert.ok(routeTarget.endsWith('/settings/env/1a21?editing=true'), `the application route targets this edit form: ${routeTarget}`);

    await render(precompileTemplate(`{{view-edit-project
      project=this.project originalProject=this.originalProject allProjects=this.allProjects
      network=this.network policyManager=this.policyManager userStore=this.userStore
      showEdit=this.showEdit editing=true
    }}`));

    let edit = find('[data-test-network-only-edit]');
    assert.ok(edit, 'the network capability exposes Edit from the detail view');

    this.network.set('actionLinks', {});
    await settled();
    assert.notOk(find('[data-test-network-only-edit]'), 'without network update the link disappears');

    this.network.set('actionLinks', {update: '/networks/1n1'});
    this.project.set('actionLinks', {update: '/projects/1a21'});
    await settled();
    assert.notOk(find('[data-test-network-only-edit]'), 'metadata editors get no duplicate header Edit link');

    this.project.set('actionLinks', {setmembers: '/projects/1a21?action=setmembers'});
    await settled();
    assert.notOk(find('[data-test-network-only-edit]'), 'member editors get no duplicate header Edit link');
    assert.ok(find('[data-test-action-menu]'), 'the existing action menu remains');

    this.project.set('actionLinks', {});
    this.set('showEdit', true);
    await settled();
    assert.notOk(find('[data-test-network-only-edit]'), 'the link is absent inside the edit form');
  });
});
