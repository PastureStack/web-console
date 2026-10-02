import { module, test } from 'qunit';
import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { defer, resolve } from 'rsvp';
import { settled } from '@ember/test-helpers';
import StoragePoolsRoute from 'ui/storagepools/route';
import PoolsRoute from 'ui/storagepools/pools/route';
import PoolsController from 'ui/storagepools/pools/controller';
import Projects from 'ui/services/projects';
import { isUnallocatedLocalVolume, refreshUnallocatedVolumeRelations } from 'ui/utils/unallocated-volumes';
import { volumeFixture } from '../utils/unallocated-volumes-test';

const localizedIncompleteMessage = '無法完整載入磁碟區的儲存集區關聯。';
const intl = {t(key) {
  return key === 'storagePoolsPage.unallocated.relationIncomplete' ? localizedIncompleteMessage : key;
}};

module('Unit | Route | storagepools volumes', function() {
  test('parent keeps its pool array and reads full scoped volume/mount collections', async function(assert) {
    const f = volumeFixture();
    f.store._state.foundAll.mount = false;
    const requests = [];
    f.store.rawRequest = (options) => {
      requests.push(options);
      const resourceType = options.url.includes('/mounts') ? 'mount' :
        options.url.includes('/volumes') ? 'volume' : 'storagePool';
      return resolve({status: 200, body: {type: 'collection', resourceType, data: resourceType === 'storagePool' ? [
        {type: 'storagePool', id: '1sp-local', driverName: 'local'},
        {type: 'storagePool', id: '1sp-hidden', driverName: null},
      ] : [], pagination: {partial: false}}});
    };
    const parent = StoragePoolsRoute.create({store: f.store});
    const child = PoolsRoute.create({store: f.store, intl, projects: EmberObject.create({current: {id: '1a2540'}}),
      modelFor(name) { assert.strictEqual(name, 'storagepools'); return this.parentArray; }});
    try {
      const pools = await parent.model();
      assert.deepEqual(pools.map((pool) => pool.get('id')), ['1sp-local'], 'unchanged parent array contract');
      assert.strictEqual(requests.length, 3);
      requests.forEach((request) => {
        const url = new URL(request.url, window.location.origin);
        assert.strictEqual(url.origin, window.location.origin, 'same origin scoped API');
        assert.true(url.pathname.startsWith('/v2-beta/projects/1a2540/'), 'project store supplies the exact scope');
        assert.notOk(request.method && request.method !== 'GET', 'reads only');
        assert.notOk(request.url.includes('state_ne'), 'inactive mounts are not omitted');
      });
      assert.true(f.store.haveAll('mount'), 'actual full find marks the mount cache complete');
      child.parentArray = pools;
      const model = await child.model();
      assert.strictEqual(model.get('all'), pools, 'child still wraps the parent array as {all}');
      const added = f.volume();
      assert.strictEqual(model.get('volumes').objectAt(0), added, 'returned volume array is the live cache');
      f.store._typeify({type: 'mount', id: '1m-new', volumeId: added.get('id'), state: 'inactive'});
      assert.strictEqual(model.get('mounts.length'), 1, 'inactive mount WS updates remain live too');
    } finally { parent.destroy(); child.destroy(); f.dispose(); }
  });

  test('live new/changed volumes are reclassified and deduplicated by complete IDs', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    await refreshUnallocatedVolumeRelations([volume], '1a2540');
    const projects = EmberObject.create({current: {id: '1a2540'}, canCreateResource() { return false; }});
    const model = EmberObject.create({all: A([]), volumes: f.store.all('volume'), mounts: f.store.all('mount')});
    const controller = PoolsController.create({store: f.store, projects, intl, model});
    try {
      await refreshUnallocatedVolumeRelations(model.get('volumes'), '1a2540');
      assert.deepEqual(controller.get('unallocatedVolumes').map((row) => row.get('id')), ['1v-new']);
      let newVolume;
      run(() => { newVolume = f.volume({id: '1v-new-suffix', name: 'same-name',
        links: {storagePools: '/v2-beta/projects/1a2540/volumes/1v-new-suffix/storagepools'}}); });
      await refreshUnallocatedVolumeRelations(model.get('volumes'), '1a2540');
      assert.deepEqual(controller.get('unallocatedVolumes').map((row) => row.get('id')), ['1v-new', '1v-new-suffix'],
        'full ID, never name or prefix, determines the row');
      const mount = run(() => f.store._typeify({type: 'mount', id: '1m-live', volumeId: newVolume.get('id'), state: 'inactive'}));
      assert.deepEqual(controller.get('unallocatedVolumes').map((row) => row.get('id')), ['1v-new']);
      run(() => f.store._remove('mount', mount));
      assert.strictEqual(controller.get('unallocatedVolumes.length'), 2);
      const oldCollection = volume.get('storagePools');
      const oldReads = f.requests.length;
      const stateRead = defer();
      f.store.rawRequest = (options) => {
        f.requests.push(options);
        return stateRead.promise;
      };
      run(() => volume.set('state', 'detached'));
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'changed state immediately invalidates allocation proof');
      stateRead.resolve({status: 200, body: {type: 'collection', resourceType: 'storagePool', data: []}});
      await settled();
      assert.strictEqual(f.requests.length, oldReads + 1, 'actual observer re-reads once after the state change');
      assert.notStrictEqual(volume.get('storagePools'), oldCollection, 'only the newly completed collection replaces the proof');
      assert.strictEqual(controller.get('unallocatedVolumes.length'), 2, 'actual new relationship read restores the row');
      run(() => model.set('volumes', A([volume, volume, newVolume])));
      await refreshUnallocatedVolumeRelations(model.get('volumes'), '1a2540');
      assert.strictEqual(controller.get('unallocatedVolumes.length'), 2, 'exact duplicate ID renders once');
      assert.deepEqual(controller.get('usefulPools'), [], 'no synthetic pool is invented');
    } finally { controller.destroy(); projects.destroy(); f.dispose(); }
  });

  test('independent Add uses current schema freshness and generation, not a role shortcut', function(assert) {
    let schema = {collectionMethods: ['GET', 'POST']};
    const projects = Projects.create({current: EmberObject.create({id: '1a2540'}),
      schemaProjectId: '1a2540', schemaLoadGeneration: 0,
      store: {canCreate(type) { return type === 'volume' && schema.collectionMethods.includes('POST'); }}});
    const controller = PoolsController.create({store: projects.get('store'), projects, intl,
      model: EmberObject.create({all: [], volumes: [], mounts: []})});
    try {
      assert.true(controller.get('canCreateVolume'), 'no pool/volume is needed for a fresh POST capability');
      schema.collectionMethods = ['GET'];
      projects.incrementProperty('schemaLoadGeneration');
      assert.false(controller.get('canCreateVolume'), 'readonly methods revoke the CTA');
      schema.collectionMethods = ['GET', 'POST'];
      projects.set('schemaProjectId', null);
      assert.false(controller.get('canCreateVolume'), 'unknown schemas remain fail-closed');
      projects.set('schemaProjectId', '1a2540');
      projects.set('current', EmberObject.create({id: '1a2541'}));
      assert.false(controller.get('canCreateVolume'), 'a different project cannot reuse the capability');
    } finally { controller.destroy(); projects.destroy(); }
  });

  test('initial relationship errors reject the route; background failures notify only once', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    const failure = {status: 403, code: 'Forbidden'};
    let calls = 0;
    volume.followLink = () => { calls++; return Promise.reject(failure); };
    const projects = EmberObject.create({current: {id: '1a2540'}, canCreateResource() { return false; }});
    const child = PoolsRoute.create({store: f.store, projects, intl, modelFor() { return []; }});
    const notices = [];
    const controller = PoolsController.create({store: f.store, projects,
      intl, growl: {fromError(title, error) { notices.push([title, error]); }},
      model: EmberObject.create({all: [], volumes: f.store.all('volume'), mounts: f.store.all('mount')})});
    try {
      try { await child.model(); assert.ok(false, 'initial error must leave the route'); }
      catch (error) { assert.strictEqual(error, failure); }
      controller.refreshVolumeRelations();
      await resolve(); await resolve();
      controller.refreshVolumeRelations();
      await resolve(); await resolve();
      assert.deepEqual(notices, [['generic.error', failure]], 'actual title/error signature and one notice');
      assert.strictEqual(calls, 1, 'background observer does not retry the failed read');
      assert.deepEqual(controller.get('unallocatedVolumes'), []);
      assert.strictEqual(volume.get('storagePools'), undefined);
      volume.followLink = () => {
        calls++;
        return resolve(f.collection([], {pagination: {partial: true}}));
      };
      run(() => volume.set('state', 'detached'));
      try { await child.model(); assert.ok(false, 'partial relationship must reject the initial route too'); }
      catch (error) { assert.strictEqual(error.message, localizedIncompleteMessage, 'initial route translates its incomplete relationship error'); }
      await settled();
      controller.refreshVolumeRelations();
      await settled();
      assert.strictEqual(notices.length, 2, 'one new localized background error, with no duplicate notice');
      assert.strictEqual(notices[1][0], 'generic.error');
      assert.strictEqual(notices[1][1].message, localizedIncompleteMessage, 'background growl retains the localized error');
      assert.strictEqual(calls, 2, 'only the changed allocation starts one new relationship read');
    } finally { controller.destroy(); child.destroy(); projects.destroy(); f.dispose(); }
  });
});
