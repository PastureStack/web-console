import { get, set } from '@ember/object';
import { isArray } from '@ember/array';
import { all, resolve } from 'rsvp';
import C from 'ui/utils/constants';

const pending = new WeakMap();
const allocationFields = ['id', 'accountId', 'driver', 'state', 'removed', 'isNative', 'isHostPath',
  'hostId', 'imageId', 'instanceId', 'externalId', 'links.storagePools', 'store.generation', 'store.baseUrl'];

function isCandidate(volume, projectId) {
  return Boolean(volume && typeof projectId === 'string' && projectId &&
    typeof get(volume, 'id') === 'string' && get(volume, 'id') &&
    get(volume, 'type') === 'volume' && get(volume, 'accountId') === projectId &&
    get(volume, 'driver') === 'local' && get(volume, 'isNative') === false &&
    get(volume, 'isHostPath') === false && get(volume, 'removed') === null &&
    typeof get(volume, 'state') === 'string' && !C.REMOVEDISH_STATES.includes(get(volume, 'state')) &&
    ['hostId', 'imageId', 'instanceId', 'externalId'].every((field) => get(volume, field) === null));
}

function emptyArray(value) {
  return isArray(value) && get(value, 'length') === 0;
}

function completeCollection(value) {
  return isArray(value) && get(value, 'type') === 'collection' &&
    get(value, 'resourceType') === 'storagePool' &&
    !get(value, 'pagination.next') && get(value, 'pagination.partial') !== true;
}

// Absence is proved by the full scoped mount cache and the advertised pool
// relationship, not by a missing field or the pools visible in this screen.
export function isUnallocatedLocalVolume(volume, projectId) {
  let pools = volume && get(volume, 'storagePools');
  let proof = volume && pending.get(volume);
  if (!isCandidate(volume, projectId) || !completeCollection(pools) || !emptyArray(pools) ||
      !proof || proof.projectId !== projectId || proof.collection !== pools ||
      !proof.identity.every((value, i) => value === get(volume, allocationFields[i]))) {
    return false;
  }
  for (let field of ['storagePoolIds', 'mountIds', 'mounts']) {
    let value = get(volume, field);
    if (value !== undefined && !emptyArray(value)) {
      return false;
    }
  }
  let store = get(volume, 'store');
  let baseUrl = store && get(store, 'baseUrl');
  return Boolean(store && typeof store.haveAll === 'function' && store.haveAll('mount') &&
    typeof baseUrl === 'string' && baseUrl.endsWith(`/projects/${projectId}`) &&
    !store.all('mount').find((mount) => get(mount, 'volumeId') === get(volume, 'id')));
}

// followLink returns the real (depaginated) Collection, including an explicit
// zero-length result.  Keep that object; never manufacture [] for an omission.
export function refreshUnallocatedVolumeRelations(volumes, projectId, incompleteMessage = 'Incomplete volume storage pool relationship') {
  return all(volumes.map((volume) => {
    if (!isCandidate(volume, projectId) || !get(volume, 'links.storagePools') ||
        typeof volume.followLink !== 'function') {
      pending.delete(volume);
      return resolve();
    }
    let identity = allocationFields.map((field) => get(volume, field));
    let previous = pending.get(volume);
    if (previous && previous.projectId === projectId &&
        identity.every((value, i) => value === previous.identity[i]) &&
        get(volume, 'storagePools') === previous.collection) {
      return previous.promise;
    }
    let request = {projectId, identity, collection: undefined};
    set(volume, 'storagePools', undefined);
    request.promise = resolve().then(() => volume.followLink('storagePools', {depaginate: true})).then((pools) => {
      if (!completeCollection(pools)) {
        throw new Error(incompleteMessage);
      }
      if (pending.get(volume) === request &&
          identity.every((value, i) => value === get(volume, allocationFields[i])) &&
          get(volume, 'storagePools') === undefined &&
          typeof get(volume, 'store.baseUrl') === 'string' &&
          get(volume, 'store.baseUrl').endsWith(`/projects/${projectId}`) && completeCollection(pools)) {
        request.collection = pools;
        set(volume, 'storagePools', pools);
      } else if (pending.get(volume) === request) {
        // An obsolete success is not an empty proof or a reusable completed
        // read, even if the project/allocation later returns to the old value.
        pending.delete(volume);
      }
    });
    // Retain the same generation/allocation read (including a rejection).
    // Initial route errors propagate; background callers display the original
    // error once. Neither another computed read nor setupController retries it.
    pending.set(volume, request);
    return request.promise;
  }));
}
