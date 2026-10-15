import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import { archiveFixture } from '../../helpers/archive';

module('Unit | Model | archive', function(hooks) {
  hooks.beforeEach(function() { this.f = archiveFixture(); });
  hooks.afterEach(function() { this.f.destroy(); });

  test('missing archive state is false and Service must be inactive with every visible instance stopped', function(assert) {
    let instance = EmberObject.create({state: 'stopped', transitioning: 'no'});
    let service = this.f.service({instances: A([instance])});
    assert.false(service.get('isArchived'), 'legacy data stays visible');
    assert.true(service.get('archiveStopped'), 'inactive with stopped containers is eligible');
    for (let state of ['active', 'activating', 'deactivating', 'upgrading', 'error']) {
      service.set('state', state);
      assert.false(service.get('archiveStopped'), `${state} is not stopped, including scale zero`);
    }
    service.set('state', 'inactive');
    instance.set('state', 'running');
    assert.false(service.get('archiveStopped'), 'a running sidekick blocks inactive Service');
    instance.setProperties({state: 'stopped', transitioning: 'yes'});
    assert.false(service.get('archiveStopped'), 'a container transition is uncertain');
    instance.setProperties({state: 'removed', transitioning: 'no'});
    assert.true(service.get('archiveStopped'), 'removed terminal instances do not block');
    service.set('transitioning', 'error');
    assert.false(service.get('archiveStopped'), 'failed service transitions remain uncertain');
    instance.destroy();
  });

  test('stable empty Stack is eligible; child instance updates invalidate the Stack guard', function(assert) {
    let stack = this.f.stack({state: 'active'});
    assert.true(stack.get('archiveStopped'), 'an empty stable Stack can be archived');
    let instance = EmberObject.create({state: 'running'});
    let service = this.f.service({instances: A([instance])});
    stack.set('services', A([service]));
    assert.false(stack.get('archiveStopped'), 'inactive child with running instance is rejected');
    instance.set('state', 'stopped');
    assert.true(stack.get('archiveStopped'), 'instance/WS update recomputes both model guards');
    service.set('state', 'active');
    assert.false(stack.get('archiveStopped'), 'active Service with zero replicas is not stopped');
    stack.setProperties({services: A([]), state: 'upgrading'});
    assert.false(stack.get('archiveStopped'), 'a transitional empty Stack is not stable');
    instance.destroy();
  });

  test('capability follows advertised field, exact resource update and schema reload epoch', function(assert) {
    let service = this.f.service();
    assert.true(service.get('archiveMenuAction.enabled'), 'field and update enable the menu');
    this.f.store.set('archiveField', undefined);
    this.f.projects.incrementProperty('schemaLoadGeneration');
    assert.false(service.get('archiveMenuAction.enabled'), 'old Engine does not expose a false-success action');
    this.f.store.set('archiveField', this.f.field);
    this.f.projects.set('schemaProjectId', null);
    assert.false(service.get('archiveCanUpdate'), 'loading schema window cannot borrow the previous grant');
    this.f.projects.set('schemaProjectId', '1a1');
    assert.true(service.get('archiveCanUpdate'), 'the same project recovers after reload');
    this.f.store.set('archiveField', {...this.f.field, update: false});
    this.f.projects.incrementProperty('schemaLoadGeneration');
    assert.false(service.get('archiveCanUpdate'), 'readonly field update is respected');
    this.f.store.set('archiveField', this.f.field);
    this.f.projects.incrementProperty('schemaLoadGeneration');
    service.set('actionLinks', {});
    assert.false(service.get('archiveMenuAction.enabled'), 'schema alone cannot update another resource ID');
  });

  test('system guards and explanation entry do not add lifecycle side effects', function(assert) {
    let opened = [];
    let service = this.f.service({state: 'active', modalService: EmberObject.create({toggleModal(...args) { opened.push(args); }})});
    assert.true(service.get('archiveMenuAction.enabled'), 'a running updateable resource can open the explanation');
    assert.strictEqual(service.get('archiveBlockReason'), 'archive.requiresStopped');
    service.get('actions').promptArchive.call(service);
    assert.strictEqual(opened[0][0], 'modal-confirm-archive');
    assert.strictEqual(opened[0][1].originalModel, service);
    service.set('system', true);
    assert.false(service.get('archiveMenuAction.enabled'), 'system archive entry is absent');
    service.set('archived', true);
    assert.true(service.get('archiveMenuAction.enabled'), 'restoring can repair archived system data');
    assert.strictEqual(service.get('archiveBlockReason'), null);
    service.setProperties({system: false, archived: false, group: 'team, Infrastructure'});
    assert.false(service.get('archiveMenuAction.enabled'), 'infra group is recognized without a system flag');
    service.setProperties({group: '', launchConfig: {labels: {'io.rancher.container.system': 'network'}}});
    assert.false(service.get('archiveMenuAction.enabled'), 'known system label uses the same backend hint');
  });

  test('parent and child archive prevent Start but retain Stop and Remove capabilities', function(assert) {
    let calls = [];
    let child = this.f.service({archived: true, doAction(name) { calls.push(name); return resolve(); }});
    let stack = this.f.stack({services: A([child]), doAction(name) { calls.push(name); return resolve(); }});
    child.set('stack', stack);
    assert.false(stack.get('canActivate'), 'bulk Start cannot activate an independently archived child');
    child.get('actions').activate.call(child);
    child.get('actions').restart.call(child);
    stack.get('actions').activateServices.call(stack);
    assert.deepEqual(calls, [], 'direct frontend action dispatch also respects archive');
    stack.set('archived', true);
    child.set('archived', false);
    assert.true(child.get('archiveStartBlocked'), 'a parent archive blocks an unarchived child');
    let actions = child.get('availableActions');
    assert.true(actions.findBy('action', 'promptStop').enabled, 'Stop keeps its original capability');
    assert.true(actions.findBy('action', 'promptDelete').enabled, 'Remove keeps its original capability');
    child.set('archived', true);
    stack.set('archived', false);
    assert.true(child.get('isArchived'), 'restoring parent does not rewrite child archive');
  });
});
