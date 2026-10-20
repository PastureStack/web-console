import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import Host from 'ui/models/host';

module('Unit | Model | host');

function diskDetails(host) {
  return (host.get('diskDetail') || []).map(disk => ({label: disk.get('label'), value: disk.get('value')}));
}

test('missing and empty disk reports stay unknown despite nonzero local storage', function(assert) {
  for (const diskInfo of [undefined, {}, {fileSystems: {}}, {mountPoints: {}}, {fileSystems: [], mountPoints: []}]) {
    let host = Host.create({info: {diskInfo}, localStorageMb: 8192});

    assert.strictEqual(host.get('diskBlurb'), undefined, 'no total is invented from empty data or localStorageMb');
    assert.strictEqual(host.get('diskDetail'), undefined, 'unknown total has no disk details');
    assert.strictEqual(host.get('localStorageBlurb'), '8 GiB', 'the separate local-storage value stays intact');
    host.destroy();
  }
});

test('invalid capacities do not become zero or poison the disk display', function(assert) {
  let invalid = [null, undefined, NaN, Infinity, -Infinity, -1, '', '1024', false];
  let fileSystems = {missing: {}, absent: null};
  let mountPoints = {missing: {}, absent: null};
  invalid.forEach((value, i) => {
    fileSystems['disk' + i] = {capacity: value};
    mountPoints['mount' + i] = {total: value};
  });
  let host = Host.create({info: {diskInfo: {fileSystems, mountPoints}}});

  assert.strictEqual(host.get('diskBlurb'), undefined, 'an entirely invalid report stays unknown');
  assert.strictEqual(host.get('diskDetail'), undefined, 'invalid disks are not formatted as zero or NaN');
  host.destroy();
});

test('empty or invalid file systems fall back to valid legacy mounts for total and details', function(assert) {
  for (const fileSystems of [{}, [], {bad: {capacity: null}}, {bad: {capacity: NaN}}]) {
    let host = Host.create({info: {diskInfo: {
      fileSystems,
      mountPoints: {'/': {total: 2048}, '/data': {total: 512}, invalid: {total: -1}},
    }}});

    assert.strictEqual(host.get('diskBlurb'), '2.5 GiB', 'legacy capacity uses the existing MiB formatter');
    assert.deepEqual(diskDetails(host), [
      {label: '/', value: '2 GiB'},
      {label: '/data', value: '512 MiB'},
    ], 'details use the same valid legacy source as the total');
    host.destroy();
  }
});

test('valid file systems take precedence and ignore invalid entries', function(assert) {
  let host = Host.create({info: {diskInfo: {
    fileSystems: {'/dev/a': {capacity: 1024}, '/dev/b': {capacity: 512}, invalid: {capacity: undefined}},
    mountPoints: {'/': {total: 8192}},
  }}});

  assert.strictEqual(host.get('diskBlurb'), '1.5 GiB', 'legacy mounts are not counted twice');
  assert.deepEqual(diskDetails(host), [
    {label: '/dev/a', value: '1 GiB'},
    {label: '/dev/b', value: '512 MiB'},
  ], 'only valid new-format entries appear in the detail');
  host.destroy();
});

test('a reported zero is valid in both formats and does not trigger fallback', function(assert) {
  let host = Host.create({info: {diskInfo: {
    fileSystems: {'/dev/empty': {capacity: 0}},
    mountPoints: {'/': {total: 8192}},
  }}});

  assert.strictEqual(host.get('diskBlurb'), '0 B', 'a valid new zero keeps its existing format');
  assert.deepEqual(diskDetails(host), [{label: '/dev/empty', value: '0 B'}], 'new zero takes precedence over legacy data');
  host.set('info.diskInfo', {mountPoints: {'/': {total: 0}}});
  assert.strictEqual(host.get('diskBlurb'), '0 B', 'a valid legacy zero stays zero');
  assert.deepEqual(diskDetails(host), [{label: '/', value: '0 B'}]);
  host.destroy();
});

test('array reports retain their existing labels and formatting', function(assert) {
  let host = Host.create({info: {diskInfo: {mountPoints: [{total: 1024}, {total: 0}]}}});

  assert.strictEqual(host.get('diskBlurb'), '1 GiB');
  assert.deepEqual(diskDetails(host), [{label: '0', value: '1 GiB'}, {label: '1', value: '0 B'}]);
  host.set('info.diskInfo', {fileSystems: [{capacity: 512}]});
  assert.strictEqual(host.get('diskBlurb'), '512 MiB');
  assert.deepEqual(diskDetails(host), [{label: '0', value: '512 MiB'}]);
  host.destroy();
});

test('disk total and details update together when a report is replaced', function(assert) {
  let host = Host.create({info: {diskInfo: {fileSystems: {}, mountPoints: {'/': {total: 2048}}}}});

  assert.strictEqual(host.get('diskBlurb'), '2 GiB');
  assert.deepEqual(diskDetails(host), [{label: '/', value: '2 GiB'}]);
  host.set('info.diskInfo.fileSystems', {'/dev/a': {capacity: 1024}});
  assert.strictEqual(host.get('diskBlurb'), '1 GiB');
  assert.deepEqual(diskDetails(host), [{label: '/dev/a', value: '1 GiB'}]);
  host.set('info.diskInfo.fileSystems', {'/dev/a': {capacity: null}});
  assert.strictEqual(host.get('diskBlurb'), '2 GiB', 'an invalid replacement returns to the valid legacy source');
  assert.deepEqual(diskDetails(host), [{label: '/', value: '2 GiB'}]);
  host.set('info.diskInfo.mountPoints', {});
  assert.strictEqual(host.get('diskBlurb'), undefined, 'removing the final valid source restores unknown');
  assert.strictEqual(host.get('diskDetail'), undefined, 'stale details disappear too');
  host.destroy();
});

test('clone is offered only while the current project can use its host driver', function(assert) {
  let project = EmberObject.create({id: '1a-owner'});
  let projects = EmberObject.create({
    current: project,
    schemaProjectId: '1a-owner',
    canAddHostDriver(driver) {
      assert.strictEqual(driver, 'custom');
      return this.get('schemaProjectId') === project.get('id') && canCreate;
    },
  });
  let canCreate = true;
  let host = Host.create({
    driver: 'custom',
    actionLinks: {},
    links: {},
    projects,
  });
  let cloneAction = () => host.get('availableActions').findBy('action', 'clone');

  assert.true(cloneAction().enabled, 'an owner sees Clone');
  projects.set('schemaProjectId', null);
  canCreate = false;
  assert.false(cloneAction().enabled, 'Clone disappears while permissions reload');
  projects.set('schemaProjectId', '1a-owner');
  assert.false(cloneAction().enabled, 'a read-only schema does not offer Clone');
  host.destroy();
});
