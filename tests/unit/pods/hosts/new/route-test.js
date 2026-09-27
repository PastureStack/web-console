import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import HostsNewRoute, {
  isSelectableMachineDriver,
  proxifyUrl
} from 'ui/hosts/new/route';
import { createOwned, destroyOwned } from '../../../../helpers/owned-subject';

module('Unit | Route | hosts/new');

test('it exists', function(assert) {
  var route = HostsNewRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('resetController clears host navigation query params on existing route', function(assert) {
  assert.expect(2);

  var route = HostsNewRoute.create();
  var controller = {
    set(key, value) {
      if (key === 'hostId') {
        assert.strictEqual(value, null);
      } else if (key === 'backTo') {
        assert.strictEqual(value, null);
      }
    },
  };

  route.resetController(controller, true);
  run(() => route.destroy());
});

test('proxifyUrl keeps local URLs and proxies remote driver UI URLs', function(assert) {
  var proxyBase = '/v1/proxy';
  var sameOrigin = `${window.location.origin}/driver.js`;

  assert.equal(proxifyUrl('http://localhost/driver.js', proxyBase), 'http://localhost/driver.js');
  assert.equal(proxifyUrl('http://rancher.local/driver.js', proxyBase), 'http://rancher.local/driver.js');
  assert.equal(proxifyUrl(sameOrigin, proxyBase), sameOrigin);
  assert.equal(proxifyUrl('https://drivers.example.com/ui.js', proxyBase), `${proxyBase}/https://drivers.example.com/ui.js`);
});

test('retired Packet provider is excluded from new host choices', function(assert) {
  assert.notOk(isSelectableMachineDriver(EmberObject.create({ name: 'packet' })));
  assert.ok(isSelectableMachineDriver(EmberObject.create({ name: 'amazonec2' })));
});

test('a direct add-host URL denies read-only access before loading registration data', function(assert) {
  assert.expect(9);
  let route = createOwned(HostsNewRoute, {
    projects: {
      canCreateResource(type) {
        assert.strictEqual(type, 'host', 'checks the current project host schema');
        return false;
      },
    },
    userStore: {
      find() {
        assert.ok(false, 'denied users must not load machine drivers or registration tokens');
      },
    },
    intl: {
      t(key) {
        assert.ok(['hostsPage.new.header.text', 'hostsPage.permissionDenied'].includes(key));
        return key === 'hostsPage.new.header.text' ? 'Add Host' :
          'You do not have permission to add hosts in this environment.';
      },
    },
  }, 'route');

  return route.beforeModel().then(() => {
    assert.ok(false, 'the denied route must reject');
  }, (error) => {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.code, 'Forbidden');
    assert.strictEqual(error.title, 'Add Host');
    assert.strictEqual(error.titleKey, 'hostsPage.new.header.text');
    assert.strictEqual(error.message,
      'You do not have permission to add hosts in this environment.');
    assert.strictEqual(error.messageKey, 'hostsPage.permissionDenied');
  }).finally(() => destroyOwned(route));
});

test('an authorized add-host route still loads available machine drivers', function(assert) {
  assert.expect(3);
  let route = createOwned(HostsNewRoute, {
    projects: {
      canCreateResource(type) {
        assert.strictEqual(type, 'host');
        return true;
      },
    },
    userStore: {
      find(type) {
        assert.strictEqual(type, 'machinedriver');
        return Promise.resolve({filterBy: () => []});
      },
    },
  }, 'route');

  return route.beforeModel().then(() => {
    assert.deepEqual(route.get('machineDrivers'), []);
  }).finally(() => destroyOwned(route));
});

test('getHost clones a host and carries over the driver config', function(assert) {
  assert.expect(7);

  var copiedConfig;
  var driverConfigRecord = { type: 'amazonec2Config' };
  var clonedHost = {
    set(key, value) {
      assert.equal(key, 'amazonec2Config');
      assert.strictEqual(value, driverConfigRecord);
    },
  };
  var sourceConfig = { region: 'us-east-1' };
  var host = {
    driver: 'amazonec2',
    amazonec2Config: sourceConfig,
    cloneForNew() {
      assert.ok(true, 'cloneForNew is called');
      return clonedHost;
    },
  };
  var route = createOwned(HostsNewRoute, {
    store: {
      find(type, id) {
        assert.equal(type, 'host');
        assert.equal(id, '1h1');
        return Promise.resolve(host);
      },
      createRecord(config) {
        copiedConfig = config;
        return driverConfigRecord;
      },
    },
  }, 'route');

  return route.getHost('1h1').then((result) => {
    assert.strictEqual(result, clonedHost);
    assert.deepEqual(copiedConfig, { region: 'us-east-1', type: 'amazonec2Config' });
    destroyOwned(route);
  });
});
