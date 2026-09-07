import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import FormResources from 'ui/components/form-resources/component';
import FormSecurity from 'ui/components/form-security/component';
import FormCommand from 'ui/components/form-command/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | hardware resources');
function create(component, fields, properties={}) {
  let instance = EmberObject.create(fields);
  let result;
  run(() => { result = createOwned(component, Object.assign({
    instance, renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    projects: EmberObject.create({current: {isWindows: false}}),
  }, properties), 'component'); });
  return result;
}
test('opening resource and existing memory/device forms preserves exact launch fields', function(assert) {
  const fields = {shmSize: 2147483648, cpuQuota: -1, memory: 2147483648, memorySwap: -1,
    memoryReservation: 524288000, devices: ['/dev/dri/renderD128:rw'], groupAdd: ['993'],
    deviceRequests: [{driver: 'custom', count: -1, capabilities: [['gpu']], options: {key: 'value'}}]};
  const before = JSON.stringify(fields);
  let form = create(FormResources, fields);
  assert.equal(form.get('shmDraft'), '2'); assert.equal(form.get('shmUnit'), 'GiB');
  assert.true(form.get('customRequests'));
  let security = create(FormSecurity, fields, {resourcesOnly: true});
  assert.equal(JSON.stringify(fields), before, 'source structure not mutated');
  Object.keys(fields).forEach((key) => assert.deepEqual(security.get(`instance.${key}`), fields[key], key));
  run(() => form.send('setMap', 'tmpfs', {}));
  assert.strictEqual(form.get('instance.tmpfs'), undefined, 'opening empty advanced map leaves field absent');
  destroyOwned(security); destroyOwned(form);
});
test('shared memory editing, unit switch and independent validation errors', function(assert) {
  let form = create(FormResources, {});
  run(() => form.send('setShm', '512'));
  assert.equal(form.get('instance.shmSize'), 536870912);
  run(() => form.send('setShmUnit', {target: {value: 'GiB'}}));
  assert.equal(form.get('shmDraft'), '0.5');
  run(() => form.send('setShm', '2'));
  assert.equal(form.get('instance.shmSize'), 2147483648);
  run(() => form.send('setShm', '-1'));
  run(() => form.send('setCpuLimit', '2'));
  assert.equal(form.get('shmError'), 'shm', 'valid CPU does not hide invalid shm draft');
  assert.equal(form.get('instance.cpuQuota'), 200000);
  run(() => form.send('setShm', ''));
  assert.strictEqual(form.get('instance.shmSize'), null);
  destroyOwned(form);
});
test('GPU mode, explicit IDs and DRM group mapping preserve unrelated permissions', function(assert) {
  let form = create(FormResources, {devices: ['/dev/null:/dev/null:r'], groupAdd: ['1000']});
  run(() => form.send('setGpuMode', {target: {value: 'selected'}}));
  assert.equal(form.get('gpuMode'), 'selected');
  assert.ok(form.get('issues').includes('formResources.errors.gpuRequest'), 'empty selected mode cannot silently save without a GPU');
  run(() => form.send('toggleDevice', {kind: 'nvidia', id: 'GPU-one'}, {target: {checked: true}}));
  assert.deepEqual(form.get('instance.deviceRequests'), [{driver: 'nvidia', deviceIds: ['GPU-one'], capabilities: [['gpu']]}]);
  const drm = {kind: 'drm', path: '/dev/dri/renderD128', groupId: 993};
  run(() => form.send('toggleDevice', drm, {target: {checked: true}}));
  assert.deepEqual(form.get('instance.groupAdd'), ['1000', '993']);
  assert.deepEqual(form.get('instance.devices'), ['/dev/null:/dev/null:r', '/dev/dri/renderD128:/dev/dri/renderD128:rw']);
  run(() => form.send('toggleDevice', drm, {target: {checked: false}}));
  assert.deepEqual(form.get('instance.devices'), ['/dev/null:/dev/null:r']);
  assert.deepEqual(form.get('instance.groupAdd'), ['1000', '993'], 'does not delete potentially user-owned group');
  assert.strictEqual(form.get('instance.privileged'), undefined);
  assert.strictEqual(form.get('instance.ipcMode'), undefined);
  destroyOwned(form);
});

test('restart controls preserve imported policies and only write after an explicit edit', function(assert) {
  const isolatedRestart = {initLabels() {}, initTerminal() {}, initStartOnce() {}};
  for (const policy of [undefined, {name: 'unless-stopped'}, {name: 'on-failure', maximumRetryCount: 0}, {name: 'custom-existing', maximumRetryCount: 7}]) {
    const form = create(FormCommand, {restartPolicy: policy}, isolatedRestart);
    assert.deepEqual(form.get('instance.restartPolicy'), policy, 'initialization preserves the exact incoming policy');
    destroyOwned(form);
  }
  const editable = create(FormCommand, {}, isolatedRestart);
  run(() => editable.set('restart', 'unless-stopped'));
  assert.deepEqual(editable.get('instance.restartPolicy'), {name: 'unless-stopped'});
  destroyOwned(editable);
  const readonly = create(FormCommand, {restartPolicy: {name: 'unless-stopped'}}, {...isolatedRestart, editing: false});
  run(() => readonly.set('restart', 'no'));
  assert.deepEqual(readonly.get('instance.restartPolicy'), {name: 'unless-stopped'});
  destroyOwned(readonly);
});
