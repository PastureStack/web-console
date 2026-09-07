// LaunchConfig is the source of truth. Reading a form must never rewrite it.
// Unsaved editor rows belong to the instance, not to whichever sidekick is
// currently visible. Weak keys keep drafts out of API serialization and release
// them when the editor's launch configurations are discarded.
const drafts = new WeakMap();
export function hardwareDraft(instance) { return drafts.get(instance) || {}; }
export function updateHardwareDraft(instance, fields) {
  drafts.set(instance, Object.assign({}, hardwareDraft(instance), fields));
  return hardwareDraft(instance);
}

export function read(object, key) {
  return object && (typeof object.get === 'function' ? object.get(key) : object[key]);
}

export function hardwareHost(instance, hosts, inheritedHostId) {
  let id = read(instance, 'requestedHostId') || inheritedHostId;
  let primary = read(instance, 'primaryHost');
  if ( !id ) { return primary; }
  // A missing newly selected host must not fall back to the old container host.
  return (hosts || []).find((host) => String(read(host, 'id')) === String(id)) ||
    (primary && String(read(primary, 'id')) === String(id) ? primary : undefined);
}

export function parseBytes(value, unit='MiB') {
  if ( value === '' || value === null || value === undefined ) { return null; }
  let match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(g(?:ib|b)?|m(?:ib|b)?)?$/i);
  let suffix = match?.[2]?.toLowerCase();
  let multiplier = suffix ? (suffix[0] === 'g' ? 1073741824 : 1048576) : {B: 1, MiB: 1048576, GiB: 1073741824}[unit];
  let bytes = Number(match?.[1]) * multiplier;
  if ( !match || !Number.isSafeInteger(bytes) || bytes <= 0 ) {
    throw new Error('shm');
  }
  return bytes;
}

export function simpleNvidiaRequest(requests) {
  if ( !requests || !requests.length ) { return true; }
  return requests.length === 1 && (!requests[0].driver || requests[0].driver === 'nvidia') &&
    JSON.stringify(requests[0].capabilities) === '[["gpu"]]' && !Object.keys(requests[0].options || {}).length;
}

export const ULIMIT_NAMES = ['as', 'core', 'cpu', 'data', 'fsize', 'locks', 'memlock', 'msgqueue', 'nice', 'nofile', 'nproc', 'rss', 'rtprio', 'rttime', 'sigpending', 'stack'];

export function hardwareInventoryReady(host, now=Date.now()) {
  let hardware = (read(host, 'info') || {}).hardwareInfo;
  let age = now - Date.parse(hardware?.collectedAt);
  return read(host, 'state') === 'active' && hardware?.status === 'available' && Number.isFinite(age) && age >= -60000 && age <= 600000;
}

export function hardwareIssues(instance, host, now=Date.now()) {
  let draft = hardwareDraft(instance);
  let issues = [draft.shmError, draft.cpuError, (draft.tmpfsInvalid || draft.sysctlsInvalid) ? 'map' : null, draft.selectingGpu ? 'gpuRequest' : null].filter(Boolean);
  let shm = read(instance, 'shmSize');
  let ipc = read(instance, 'ipcMode');
  let runtime = read(instance, 'runtime');
  let requests = read(instance, 'deviceRequests') || [];
  let devices = read(instance, 'devices') || [];
  if ( shm !== null && shm !== undefined && (shm < 0 || !Number.isSafeInteger(Number(shm))) ) { issues.push('shm'); }
  if ( shm > 0 && ipc && ['private', 'shareable'].indexOf(ipc) < 0 ) { issues.push('ipcConflict'); }
  let pids = read(instance, 'pidsLimit');
  if ( pids !== null && pids !== undefined && pids !== '' && (Number(pids) < -1 || !Number.isSafeInteger(Number(pids))) ) { issues.push('pids'); }
  let quota = Number(read(instance, 'cpuQuota') || 0);
  let period = Number(read(instance, 'cpuPeriod') || 0);
  if ( !Number.isSafeInteger(quota) || (quota !== 0 && quota !== -1 && quota < 1000) ||
    !Number.isSafeInteger(period) || (period !== 0 && (period < 1000 || period > 1000000)) ) { issues.push('cpu'); }
  let limits = read(instance, 'ulimits') || [];
  let names = new Set();
  limits.forEach((limit) => {
    let name = read(limit, 'name');
    let soft = Number(read(limit, 'soft'));
    let hard = Number(read(limit, 'hard'));
    if ( !ULIMIT_NAMES.includes(name) || names.has(name) || read(limit, 'soft') == null || read(limit, 'hard') == null ||
      !Number.isSafeInteger(soft) || !Number.isSafeInteger(hard) || soft < -1 || hard < -1 ||
      (hard !== -1 && (soft === -1 || soft > hard)) ) { issues.push('ulimits'); }
    names.add(name);
  });
  ['tmpfs', 'sysctls'].forEach((key) => {
    let map = read(instance, key) || {};
    if ( typeof map !== 'object' || Array.isArray(map) || Object.keys(map).some((name) =>
      !name.trim() || typeof map[name] !== 'string' ||
      (key === 'tmpfs' && (!name.startsWith('/') || name.includes('\0') || name.split('/').includes('..'))) ||
      (key === 'sysctls' && (!/^[A-Za-z0-9_.]+$/.test(name) || !map[name].trim()))) ) { issues.push('map'); }
  });
  if ( !Array.isArray(requests) || !Array.isArray(devices) ) { issues.push('gpuRequest'); return [...new Set(issues)]; }
  requests.forEach((request) => {
    if ( !request || typeof request !== 'object' ) { issues.push('gpuRequest'); return; }
    let ids = request.deviceIds || [];
    if ( !Array.isArray(ids) ) { issues.push('gpuRequest'); return; }
    let count = Number(request.count || 0);
    if ( !Number.isSafeInteger(count) || count < -1 || (!!ids.length === (count !== 0)) ||
      ids.some((id) => !String(id).trim()) || new Set(ids).size !== ids.length ||
      !Array.isArray(request.capabilities) || !request.capabilities.length ||
      request.capabilities.some((caps) => !Array.isArray(caps) || !caps.length || caps.some((cap) => !cap)) ) { issues.push('gpuRequest'); }
  });
  devices.forEach((device) => {
    if ( typeof device !== 'string' ) { issues.push('device'); return; }
    let parts = device.split(':');
    let permissions = parts.length === 3 ? parts[2] : (parts.length === 2 && !parts[1].startsWith('/') ? parts[1] : 'rwm');
    if ( !parts[0].startsWith('/') || parts.length > 3 || parts.some((part) => !part) ||
      parts.some((part) => /(^|\/)\.\.?($|\/)/.test(part)) || !/^[rwm]+$/.test(permissions) || new Set(permissions).size !== permissions.length ||
      (parts.length === 3 && !parts[1].startsWith('/')) ) { issues.push('device'); }
  });
  if ( issues.includes('gpuRequest') || issues.includes('device') ) { return [...new Set(issues)]; }
  let graphicsMappings = devices.filter((device) => /^\/dev\/(dri\/|kfd(?:$|:))/.test(device));
  if ( !requests.length && !runtime && !graphicsMappings.length ) { return [...new Set(issues)]; }
  if ( !host ) { issues.push('hostRequired'); return [...new Set(issues)]; }
  if ( read(host, 'state') !== 'active' ) { issues.push('hostInactive'); }
  let info = read(host, 'info') || {};
  let hardware = info.hardwareInfo;
  if ( !hardware || hardware.status !== 'available' || !Number.isFinite(Date.parse(hardware.collectedAt)) ||
    now - Date.parse(hardware.collectedAt) > 600000 || Date.parse(hardware.collectedAt) - now > 60000 ) {
    issues.push('inventoryUnavailable');
    return [...new Set(issues)];
  }
  if ( runtime && (hardware.runtimes || []).indexOf(runtime) < 0 ) { issues.push('runtimeUnavailable'); }
  let nvidia = (hardware.devices || []).filter((device) => device.kind === 'nvidia');
  requests.forEach((request) => {
    if ( request.driver && request.driver !== 'nvidia' ) { return; }
    if ( !hardware.deviceRequestsSupported || !nvidia.length || (hardware.runtimes || []).indexOf('nvidia') < 0 ||
      request.count > nvidia.length || (request.deviceIds || []).some((id) => !nvidia.some((gpu) => gpu.id === id)) ) { issues.push('gpuUnavailable'); }
  });
  graphicsMappings.forEach((device) => {
    let path = device.split(':')[0];
    let match = (hardware.devices || []).find((gpu) => gpu.path === path);
    if ( !match ) { issues.push('deviceUnavailable'); }
    else if ( !(read(instance, 'groupAdd') || []).some((group) => String(group) === String(match.groupId)) ) { issues.push('deviceGroup'); }
  });
  return [...new Set(issues)];
}
