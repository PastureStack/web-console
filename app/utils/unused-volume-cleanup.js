import Ember from 'ember';

const TEST_MARKER = /(^|[-_])(test|smoke|e2e|poc|validation|candidate|preview|demo|ci|fail)([-_]|$)/i;
const PROTECTED_MARKER = /(^|[-_])(backup|restore|rollback|production|prod|current)([-_]|$)/i;

function value(resource, key) {
  if ( resource && typeof resource.get === 'function' )
  {
    return resource.get(key);
  }

  return resource ? resource[key] : undefined;
}

function asArray(items) {
  if ( !items )
  {
    return [];
  }

  if ( typeof items.toArray === 'function' )
  {
    return items.toArray();
  }

  return Array.isArray(items) ? items : [];
}

export function hasActiveMount(volume) {
  return asArray(value(volume, 'mounts')).some((mount) => {
    return value(mount, 'state') === 'active' && !value(mount, 'removed');
  });
}

export function isDetachedUnusedVolume(volume) {
  let actionLinks = value(volume, 'actionLinks') || {};

  return value(volume, 'state') === 'detached' &&
    !value(volume, 'removed') &&
    !value(volume, 'instanceId') &&
    !hasActiveMount(volume) &&
    !!actionLinks.remove;
}

export function isUnusedTestVolume(volume) {
  if ( !isDetachedUnusedVolume(volume) )
  {
    return false;
  }

  let name = String(value(volume, 'name') || value(volume, 'externalId') || '');

  return TEST_MARKER.test(name) &&
    !PROTECTED_MARKER.test(name);
}

export function classifyUnusedVolumes(volumes) {
  let unused = asArray(volumes).filter(isDetachedUnusedVolume);
  let candidates = unused.filter(isUnusedTestVolume);

  return {
    candidates,
    protected: unused.filter((volume) => candidates.indexOf(volume) === -1),
  };
}

export function runWithConcurrency(items, limit, worker) {
  let list = asArray(items);
  let cursor = 0;
  let count = Math.max(1, Math.min(parseInt(limit, 10) || 1, list.length || 1));

  function next() {
    if ( cursor >= list.length )
    {
      return Ember.RSVP.resolve();
    }

    let item = list[cursor++];
    return Ember.RSVP.resolve(worker(item)).then(next);
  }

  let workers = [];
  for ( let i = 0 ; i < count ; i++ )
  {
    workers.push(next());
  }

  return Ember.RSVP.all(workers);
}

export {
  PROTECTED_MARKER,
  TEST_MARKER,
};
