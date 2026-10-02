import { module, test } from 'qunit';
import { setOwner } from '@ember/application';
import { get } from '@ember/object';
import { defer, resolve, reject } from 'rsvp';
import Store from 'ember-api-store/services/store';
import Resource from 'ember-api-store/models/resource';
import Schema from 'ember-api-store/models/schema';
import Collection from 'ember-api-store/models/collection';
import Volume from 'ui/models/volume';
import { isUnallocatedLocalVolume, refreshUnallocatedVolumeRelations } from 'ui/utils/unallocated-volumes';

// Actual Store, Volume, Collection and followLink; only the HTTP boundary is
// replaced.  No generated default relationship is treated as API evidence.
export function volumeFixture() {
  const factories = [];
  const requests = [];
  const store = Store.create({
    baseUrl: '/v2-beta/projects/1a2540',
    rawRequest(options) {
      requests.push(options);
      return resolve({status: 200, body: {
        type: 'collection', resourceType: 'storagePool', data: [], pagination: {partial: false},
      }});
    },
  });
  setOwner(store, {lookup(name) {
    if (name === 'service:fastboot') {
      return {isFastBoot: false};
    }
    const Factory = name === 'model:schema' ? Schema : name === 'model:collection' ? Collection :
      name === 'model:volume' ? Volume : Resource;
    const instance = Factory.create();
    factories.push(instance);
    return instance;
  }});
  store._bulkAdd('schema', ['volume', 'mount', 'storagePool'].map((id) => ({
    type: 'schema', id, resourceFields: {}, collectionMethods: ['GET'],
    links: {collection: `/v2-beta/projects/1a2540/${id.toLowerCase()}s`},
  })));
  store._state.foundAll.mount = true;
  return {
    store, requests,
    volume(properties = {}) {
      return store._typeify({
        type: 'volume', id: '1v-new', accountId: '1a2540', driver: 'local', state: 'active', removed: null,
        isNative: false, isHostPath: false, hostId: null, imageId: null, instanceId: null, externalId: null,
        links: {storagePools: '/v2-beta/projects/1a2540/volumes/1v-new/storagepools'},
        ...properties,
      });
    },
    collection(data = [], properties = {}) {
      return store._typeify({type: 'collection', resourceType: 'storagePool', data,
        pagination: {partial: false}, ...properties});
    },
    dispose() {
      ['schema', 'volume', 'mount', 'storagePool'].forEach((type) => store.all(type).forEach((row) => row.destroy()));
      factories.forEach((factory) => factory.destroy());
      store.destroy();
    },
  };
}

module('Unit | Utils | unallocated volumes', function() {
  test('only explicit local, environment-owned and reference-free volumes qualify', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    try {
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'missing pool relationship is unknown');
      assert.deepEqual(volume.get('mounts'), [], 'actual denormalize getter defaults to empty');
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'that default does not prove allocation');
      await refreshUnallocatedVolumeRelations([volume], '1a2540');
      assert.true(isUnallocatedLocalVolume(volume, '1a2540'));
      assert.strictEqual(volume.get('storagePools.type'), 'collection', 'keep actual relationship Collection');
      const collection = volume.get('storagePools');
      await refreshUnallocatedVolumeRelations([volume], '1a2540');
      assert.strictEqual(f.requests.length, 1, 'same completed allocation is not read again');
      assert.strictEqual(volume.get('storagePools'), collection);
      const exclusions = {
        driver: ['docker', null, 'external'], accountId: ['1a2541', null],
        isNative: [true, undefined], isHostPath: [true, undefined],
        hostId: ['1h1', undefined], imageId: ['1i1', undefined], instanceId: ['1i2', undefined],
        removed: ['2026-10-03T00:00:00Z', undefined], externalId: ['docker-id', undefined, false, 0],
        state: ['removed', 'purging', 'purged', undefined],
      };
      for (let field of Object.keys(exclusions)) {
        const original = volume.get(field);
        for (let value of exclusions[field]) {
          volume.set(field, value);
          assert.false(isUnallocatedLocalVolume(volume, '1a2540'), `${field}=${value} cannot qualify`);
        }
        volume.set(field, original);
      }
      assert.false(isUnallocatedLocalVolume(volume, null), 'no selected environment');
      volume.set('storagePools', []);
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'a manufactured/default array is not collection proof');
    } finally { f.dispose(); }
  });

  test('full mount cache excludes inactive and unresolved workload references by exact volume ID', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    try {
      await refreshUnallocatedVolumeRelations([volume], '1a2540');
      f.store._state.foundAll.mount = false;
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'unknown collection is not empty');
      f.store._state.foundAll.mount = true;
      f.store._typeify({type: 'mount', id: '1m1', volumeId: '1v-other', state: 'inactive'});
      assert.true(isUnallocatedLocalVolume(volume, '1a2540'), 'unrelated full ID is not this volume');
      const mount = f.store._typeify({type: 'mount', id: '1m2', volumeId: volume.get('id'),
        instanceId: 'not-in-cache', state: 'inactive'});
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'inactive unresolved instance still owns its volume');
      f.store._remove('mount', mount);
      volume.set('mountIds', ['missing-mount']);
      assert.deepEqual(volume.get('mounts'), [], 'unresolved denormalized IDs give empty display');
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'raw nonempty IDs remain protected');
      volume.set('mountIds', []);
      volume.set('storagePoolIds', ['missing-pool']);
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'invisible pool ID is still allocation');
      volume.set('storagePoolIds', []);
      f.store.set('baseUrl', '/v2-beta/projects/1a2541');
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'other project cache is not authority');
    } finally { f.dispose(); }
  });

  test('failed, partial and mapped relationship responses never become an empty proof', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    try {
      const failure = new Error('relationship unavailable');
      volume.followLink = () => reject(failure);
      try {
        await refreshUnallocatedVolumeRelations([volume], '1a2540');
        assert.ok(false, 'the original relationship failure must reject');
      } catch (error) { assert.strictEqual(error, failure); }
      assert.strictEqual(volume.get('storagePools'), undefined);
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'));
      volume.followLink = () => resolve(f.collection([], {pagination: {partial: true}}));
      volume.set('state', 'detached');
      const localizedMessage = '無法完整載入磁碟區的儲存集區關聯。';
      await assert.rejects(refreshUnallocatedVolumeRelations([volume], '1a2540', localizedMessage),
        new RegExp(localizedMessage), 'incomplete relationship uses the supplied localized message');
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'incomplete empty page is unknown');
      volume.set('storagePools', f.collection([{type: 'storagePool', id: '1sp-hidden', driverName: null}]));
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'), 'mapping to a hidden/non-driver pool is not a difference set');
    } finally { f.dispose(); }
  });

  test('sync, HTTP403 and network errors preserve the original error without automatic retries', async function(assert) {
    const f = volumeFixture();
    const failures = [new Error('synchronous failure'), {status: 403, code: 'Forbidden'}, new Error('network unavailable')];
    try {
      for (let i = 0; i < failures.length; i++) {
        const volume = f.volume({id: `1v-error-${i}`});
        const original = failures[i];
        let calls = 0;
        volume.followLink = () => {
          calls++;
          if (i === 0) { throw original; }
          return reject(original);
        };
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await refreshUnallocatedVolumeRelations([volume], '1a2540');
            assert.ok(false, 'unknown reads must reject');
          } catch (error) { assert.strictEqual(error, original, 'preserve the exact source error'); }
        }
        assert.strictEqual(calls, 1, 'same generation/allocation has one read, not a retry');
        assert.strictEqual(volume.get('storagePools'), undefined);
      }
    } finally { f.dispose(); }
  });

  test('late relationship reads cannot overwrite a newer allocation or another project', async function(assert) {
    const f = volumeFixture();
    const volume = f.volume();
    const response = defer();
    f.store.rawRequest = () => response.promise;
    try {
      const loading = refreshUnallocatedVolumeRelations([volume], '1a2540');
      await resolve();
      const mapped = f.collection([{type: 'storagePool', id: '1sp-new'}]);
      volume.set('storagePools', mapped); // the same assignment used by a WS resource update
      response.resolve({status: 200, body: {type: 'collection', resourceType: 'storagePool', data: []}});
      await loading;
      assert.strictEqual(volume.get('storagePools'), mapped, 'do not replace the newly observed relationship');
      assert.false(isUnallocatedLocalVolume(volume, '1a2540'));
      const otherResponse = defer();
      f.store.rawRequest = () => otherResponse.promise;
      const switched = refreshUnallocatedVolumeRelations([volume], '1a2540');
      await resolve();
      f.store.set('baseUrl', '/v2-beta/projects/1a2541');
      otherResponse.resolve({status: 200, body: {type: 'collection', resourceType: 'storagePool', data: []}});
      await switched;
      assert.strictEqual(get(volume, 'storagePools'), undefined, 'a previous project response stays unknown');
      f.store.set('baseUrl', '/v2-beta/projects/1a2540');
      const g1 = defer();
      const g2 = defer();
      let requestCount = 0;
      f.store.rawRequest = () => (++requestCount === 1 ? g1 : g2).promise;
      const priorGeneration = refreshUnallocatedVolumeRelations([volume], '1a2540');
      await resolve();
      f.store.incrementProperty('generation');
      const currentGeneration = refreshUnallocatedVolumeRelations([volume], '1a2540');
      await resolve();
      g1.resolve({status: 200, body: {type: 'collection', resourceType: 'storagePool', data: []}});
      await priorGeneration;
      assert.strictEqual(volume.get('storagePools'), undefined, 'same project, older generation cannot bind');
      g2.resolve({status: 200, body: {type: 'collection', resourceType: 'storagePool', data: []}});
      await currentGeneration;
      assert.true(isUnallocatedLocalVolume(volume, '1a2540'), 'only the current generation empty relationship qualifies');
    } finally { f.dispose(); }
  });
});
