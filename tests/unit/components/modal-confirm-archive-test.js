import EmberObject from '@ember/object';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import Modal from 'ui/components/modal-confirm-archive/component';
import { archiveFixture } from '../../helpers/archive';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';
import inertRenderer from '../../helpers/inert-renderer';

module('Unit | Component | archive modal', function(hooks) {
  hooks.beforeEach(function() {
    this.f = archiveFixture();
    this.closed = [];
  });
  hooks.afterEach(function() { this.f.destroy(); });

  function modal(context, resource, archived = true) {
    let closed = context.closed;
    return createOwned(Modal, {
      renderer: inertRenderer(), projects: context.f.projects,
      intl: {t(key) { return key; }},
      modalService: EmberObject.create({modalVisible: true,
        modalOpts: {originalModel: resource, archived, escToClose: true},
        toggleModal() { closed.push(true); },
      }),
    }, 'component');
  }

  test('Cancel and stopped/capability/project rechecks make no resource writes', async function(assert) {
    let writes = 0;
    let resource = this.f.service({state: 'active', save() { writes++; return resolve(); }});
    let component = modal(this, resource);
    assert.strictEqual(component.get('blockReason'), 'archive.requiresStopped');
    assert.false(await component.actions.confirm.call(component));
    resource.set('state', 'inactive');
    assert.false(component.get('submitDisabled'), 'live stop update enables confirmation');
    resource.set('actionLinks', {});
    assert.strictEqual(component.get('blockReason'), 'archive.readOnly');
    assert.false(await component.actions.confirm.call(component));
    resource.set('actionLinks', {update: '/update'});
    this.f.projects.set('current', EmberObject.create({id: '1a2'}));
    assert.false(await component.actions.confirm.call(component));
    component.actions.cancel.call(component);
    assert.strictEqual(writes, 0);
    assert.strictEqual(this.closed.length, 1, 'Cancel simply closes');
    destroyOwned(component);
  });

  test('real Resource.save sends only archived despite dirty metadata and retains response/WS updates', async function(assert) {
    let requests = [];
    let resource = this.f.service({
      name: 'unsaved edit', scale: 9, archived: false,
      links: {self: '/v2-beta/projects/1a1/services/1s1'},
      request(options) {
        requests.push({method: options.method, url: options.url, data: options.data});
        this.setProperties({archived: options.data.archived, name: 'server-owned-name', state: 'inactive'});
        return resolve(this);
      },
    });
    let component = modal(this, resource);
    assert.true(await component.actions.confirm.call(component));
    assert.deepEqual(requests, [{method: 'PUT', url: '/v2-beta/projects/1a1/services/1s1', data: {archived: true}}],
      'installed Resource.save excludes dirty name, scale, services and lifecycle fields from the actual request boundary');
    assert.true(resource.get('isArchived'));
    assert.strictEqual(resource.get('name'), 'server-owned-name', 'frontend does not overwrite returned model fields');
    assert.strictEqual(this.closed.length, 1);
    destroyOwned(component);
  });

  test('pending submit locks synchronously; failure stays open with localized error and permits retry', async function(assert) {
    let pending = defer();
    let writes = 0;
    let resource = this.f.service({save() { writes++; return writes === 1 ? pending.promise : resolve(); }});
    let component = modal(this, resource);
    let first = component.actions.confirm.call(component);
    assert.true(component.get('saving'));
    assert.false(await component.actions.confirm.call(component));
    component.actions.cancel.call(component);
    assert.false(component.escToClose(), 'Escape cannot interrupt a pending save');
    assert.strictEqual(this.closed.length, 0);
    pending.reject({status: 422, code: 'ArchiveRequiresStopped'});
    assert.false(await first);
    assert.deepEqual(component.get('errors'), ['archive.requiresStopped']);
    assert.false(component.get('saving'));
    assert.false(resource.get('isArchived'), 'failure never changes the resource optimistically');
    assert.true(await component.actions.confirm.call(component));
    assert.strictEqual(writes, 2);
    assert.strictEqual(this.closed.length, 1);
    destroyOwned(component);
  });

  test('restore changes only parent archive and catches sync/network failures without losing form', async function(assert) {
    let child = this.f.service({archived: true});
    let requests = [];
    let resource = this.f.stack({archived: true, services: [child], save(options) {
      requests.push(options.data);
      return reject(new Error('Network unavailable'));
    }});
    let component = modal(this, resource, false);
    assert.false(await component.actions.confirm.call(component));
    assert.deepEqual(requests, [{archived: false}]);
    assert.deepEqual(component.get('errors'), ['Network unavailable']);
    assert.true(child.get('isArchived'), 'restore never rewrites an independently archived child');
    assert.false(component.get('saving'));
    assert.strictEqual(this.closed.length, 0);
    resource.set('save', () => { throw new Error('Synchronous failure'); });
    assert.false(await component.actions.confirm.call(component));
    assert.deepEqual(component.get('errors'), ['Synchronous failure']);
    destroyOwned(component);
  });
});
