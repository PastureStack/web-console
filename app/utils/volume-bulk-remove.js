import { resolve, all } from 'rsvp';

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

export function isBulkRemovableVolume(volume) {
  let actionLinks = value(volume, 'actionLinks') || {};

  return value(volume, 'state') === 'detached' &&
    !value(volume, 'removed') &&
    !value(volume, 'instanceId') &&
    !hasActiveMount(volume) &&
    !!actionLinks.remove;
}

export function filterVolumesByState(volumes, stateFilter) {
  let list = asArray(volumes);

  switch ( stateFilter )
  {
  case 'active':
    return list.filter((volume) => value(volume, 'state') === 'active');
  case 'detached':
    return list.filter((volume) => value(volume, 'state') === 'detached');
  default:
    return list.slice();
  }
}

export function runWithConcurrency(items, limit, worker) {
  let list = asArray(items);
  let cursor = 0;
  let count = Math.max(1, Math.min(parseInt(limit, 10) || 1, list.length || 1));

  function next() {
    if ( cursor >= list.length )
    {
      return resolve();
    }

    let item = list[cursor++];
    return resolve(worker(item)).then(next);
  }

  let workers = [];
  for ( let i = 0 ; i < count ; i++ )
  {
    workers.push(next());
  }

  return all(workers);
}
