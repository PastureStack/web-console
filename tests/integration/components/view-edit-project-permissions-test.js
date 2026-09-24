import { A } from '@ember/array';
import Component from '@ember/component';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { click, find, findAll, render, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
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
    this.testRoot.remove();
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
});
