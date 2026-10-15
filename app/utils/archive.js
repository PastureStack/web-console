import { get } from '@ember/object';

export function systemResource(resource) {
  if ( !resource ) {
    return false;
  }
  let groups = String(get(resource, 'group') || '').split(',').map(group => group.trim().toLowerCase());
  let labels = get(resource, 'launchConfig.labels') || {};
  let label = String(labels['io.rancher.container.system'] || '').trim().toLowerCase();
  return get(resource, 'system') === true || get(resource, 'data.system') === true ||
    get(resource, 'data.isSystem') === true || groups.some(group => ['infra', 'infrastructure', 'system'].includes(group)) ||
    (label !== '' && label !== 'false');
}

export function instancesStopped(instances) {
  return (instances || []).every((instance) => {
    let state = get(instance, 'state');
    return ['removed', 'purged'].includes(state) ||
      (state === 'stopped' && !['yes', 'error'].includes(get(instance, 'transitioning')));
  });
}

export function serviceStopped(service) {
  return get(service, 'state') === 'inactive' &&
    !['yes', 'error'].includes(get(service, 'transitioning')) &&
    instancesStopped(get(service, 'instances'));
}
