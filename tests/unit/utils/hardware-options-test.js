import { module, test } from 'qunit';
import { parseBytes, hardwareIssues, simpleNvidiaRequest, hardwareHost } from 'ui/utils/hardware-options';

module('Unit | Utils | hardware options');
test('host resolution respects sidekick inheritance and never silently reuses the old host', function(assert) {
  const old = {id: 'old-host'}, next = {id: 'new-host'};
  assert.strictEqual(hardwareHost({primaryHost: old}, [old, next], 'new-host'), next);
  assert.strictEqual(hardwareHost({requestedHostId: 'missing', primaryHost: old}, [old, next]), undefined);
  assert.strictEqual(hardwareHost({requestedHostId: 'old-host', primaryHost: old}, []), old);
  assert.strictEqual(hardwareHost({primaryHost: old}, []), old);
});
const now = Date.now();
function host() {
  return {state: 'active', info: {hardwareInfo: {
    status: 'available', collectedAt: new Date(now).toISOString(), runtimes: ['runc', 'nvidia'],
    deviceRequestsSupported: true, devices: [
      {kind: 'nvidia', id: 'GPU-one'}, {kind: 'nvidia', id: 'GPU-two'},
      {kind: 'drm', path: '/dev/dri/renderD128', groupId: 993}, {kind: 'kfd', path: '/dev/kfd', groupId: 44},
    ],
  }}};
}
test('shared memory units are exact, optional and bounded', function(assert) {
  assert.equal(parseBytes('2', 'GiB'), 2147483648);
  assert.equal(parseBytes('2g'), 2147483648);
  assert.equal(parseBytes('512 MiB'), 536870912);
  assert.equal(parseBytes('512', 'MiB'), 536870912);
  assert.equal(parseBytes('0.5', 'GiB'), 536870912);
  assert.strictEqual(parseBytes(''), null);
  ['-1', 'oops', '0', '9007199254740992'].forEach((value) => assert.throws(() => parseBytes(value)));
  assert.deepEqual(hardwareIssues({shmSize: 2147483648}, null, now), [], 'shm alone does not force host pinning');
  assert.ok(hardwareIssues({shmSize: 2147483648, ipcMode: 'host'}, null, now).includes('ipcConflict'));
});
test('NVIDIA count/all/UUID and DRM/ROCm contracts validate without changing fields', function(assert) {
  [
    {deviceRequests: [{driver: 'nvidia', count: -1, capabilities: [['gpu']]}]},
    {deviceRequests: [{driver: 'nvidia', count: 2, capabilities: [['gpu']]}]},
    {runtime: 'nvidia', deviceRequests: [{deviceIds: ['GPU-one'], capabilities: [['gpu']]}]},
    {devices: ['/dev/dri/renderD128:/dev/dri/renderD128:rw', '/dev/kfd:rw'], groupAdd: ['993', '44']},
  ].forEach((config) => {
    const before = JSON.stringify(config);
    assert.deepEqual(hardwareIssues(config, host(), now), []);
    assert.equal(JSON.stringify(config), before, 'validation is read-only');
  });
  assert.notOk(simpleNvidiaRequest([{driver: 'custom', count: -1, capabilities: [['gpu']], options: {mode: 'keep'}}]));
});
test('invalid, absent and stale hardware is not reported as supported', function(assert) {
  const gpu = {deviceRequests: [{driver: 'nvidia', count: 1, capabilities: [['gpu']]}]};
  assert.ok(hardwareIssues(gpu, null, now).includes('hostRequired'));
  assert.ok(hardwareIssues(gpu, host(), now + 600001).includes('inventoryUnavailable'));
  let unavailable = host(); unavailable.info.hardwareInfo.runtimes = ['runc'];
  assert.ok(hardwareIssues(gpu, unavailable, now).includes('gpuUnavailable'));
  assert.ok(hardwareIssues({deviceRequests: [{count: 1, deviceIds: ['GPU-one'], capabilities: [['gpu']]}]}, host(), now).includes('gpuRequest'));
  assert.ok(hardwareIssues({deviceRequests: [{deviceIds: ['GPU-missing'], capabilities: [['gpu']]}]}, host(), now).includes('gpuUnavailable'));
  assert.ok(hardwareIssues({devices: ['/dev/dri/renderD999']}, host(), now).includes('deviceUnavailable'));
  assert.ok(hardwareIssues({devices: ['/dev/dri/renderD128'], groupAdd: ['44']}, host(), now).includes('deviceGroup'), 'a new host requires its actual device GID');
  ['not-a-device', '/dev/null:bad', '/dev/null:/dev/null:rr', '/dev/../null'].forEach((device) => {
    assert.ok(hardwareIssues({devices: [device]}, host(), now).includes('device'));
  });
});
test('advanced limits reject contradictory settings but accept unlimited', function(assert) {
  assert.deepEqual(hardwareIssues({pidsLimit: -1, cpuQuota: -1, ulimits: [{name: 'memlock', soft: -1, hard: -1}], tmpfs: {'/run': ''}}, null), []);
  assert.deepEqual(hardwareIssues({pidsLimit: 0}, null), [], 'Docker inspect default 0 remains editable');
  assert.ok(hardwareIssues({pidsLimit: -2}, null).includes('pids'));
  assert.ok(hardwareIssues({cpuQuota: 500}, null).includes('cpu'));
  assert.ok(hardwareIssues({cpuPeriod: 1000001}, null).includes('cpu'));
  assert.ok(hardwareIssues({ulimits: [{name: 'nofile', soft: 4096, hard: 1024}]}, null).includes('ulimits'));
  assert.ok(hardwareIssues({tmpfs: {relative: 'size=64m'}}, null).includes('map'));
});
