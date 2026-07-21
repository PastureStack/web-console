import { module, test } from 'qunit';

import Ember from 'ember';
import HostsNewRoute, { proxifyUrl } from 'ui/hosts/new/route';

module('Unit | Route | hosts/new');

test('it exists', function(assert) {
  var route = HostsNewRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
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
  Ember.run(() => route.destroy());
});

test('proxifyUrl keeps local URLs and proxies remote driver UI URLs', function(assert) {
  var proxyBase = '/v1/proxy';
  var sameOrigin = `${window.location.origin}/driver.js`;

  assert.equal(proxifyUrl('http://localhost/driver.js', proxyBase), 'http://localhost/driver.js');
  assert.equal(proxifyUrl('http://rancher.local/driver.js', proxyBase), 'http://rancher.local/driver.js');
  assert.equal(proxifyUrl(sameOrigin, proxyBase), sameOrigin);
  assert.equal(proxifyUrl('https://drivers.example.com/ui.js', proxyBase), `${proxyBase}/https://drivers.example.com/ui.js`);
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
  var route = HostsNewRoute.create({
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
  });

  return route.getHost('1h1').then((result) => {
    assert.strictEqual(result, clonedHost);
    assert.deepEqual(copiedConfig, { region: 'us-east-1', type: 'amazonec2Config' });
    Ember.run(() => route.destroy());
  });
});
