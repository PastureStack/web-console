import { module, test } from 'qunit';

import {
  parentRouteInfo,
  routeInfoArguments,
} from 'ui/initializers/extend-ember-route';

module('Unit | Initializer | extend ember route navigation');

test('derives ordered model arguments from the public RouteInfo chain', function(assert) {
  let application = {
    name: 'application',
    paramNames: [],
    params: {},
    parent: null,
  };
  let project = {
    name: 'authenticated.project',
    paramNames: ['project_id'],
    params: {project_id: '1a5'},
    parent: application,
  };
  let host = {
    name: 'host',
    paramNames: ['host_id'],
    params: {host_id: '1h1'},
    parent: project,
  };

  assert.deepEqual(routeInfoArguments(host), ['1a5', '1h1']);
});

test('skips an index route and its immediate parent when going up', function(assert) {
  let infrastructure = {name: 'infrastructure-tab', parent: null};
  let hosts = {name: 'hosts', parent: infrastructure};
  let index = {name: 'hosts.index', parent: hosts};

  assert.strictEqual(parentRouteInfo(index), infrastructure);
  assert.strictEqual(parentRouteInfo(hosts), infrastructure);
  assert.strictEqual(parentRouteInfo(null), null);
});
