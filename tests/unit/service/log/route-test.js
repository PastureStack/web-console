import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import ServiceLogRoute from 'ui/service/log/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | service | log');

test('keeps every query fixed to the current service while mapping visible filters', function(assert) {
  let route = createOwned(ServiceLogRoute, {}, 'route');
  let query = route.parseFilters('1s197', {
    createdFrom: '2026-08-31T01:00:00.000Z',
    createdTo: '2026-08-31T02:00:00.000Z',
    level: 'error',
    instanceId: '1i22860',
    logScope: 'root',
    eventType: 'service.instance.',
    eventTypeOperator: 'startsWith',
    description: 'restart',
    descriptionOperator: 'contains',
    serviceId: '1s999',
  });

  assert.deepEqual(query, {
    filter: {
      serviceId: '1s197',
      created_gte: '2026-08-31T01:00:00.000Z',
      created_lte: '2026-08-31T02:00:00.000Z',
      level: 'error',
      instanceId: '1i22860',
      subLog: 'false',
      eventType_prefix: 'service.instance.',
      description_like: '%restart%',
    },
    sortBy: 'created',
    sortOrder: 'desc',
    depaginate: false,
    forceReload: true,
    limit: 100,
  }, 'the caller cannot broaden the fixed service authority');

  destroyOwned(route);
});

test('maps root, detail, and all scopes without leaking UI-only values', function(assert) {
  let route = createOwned(ServiceLogRoute, {}, 'route');

  assert.strictEqual(route.parseFilters('1s1', {logScope: 'root'}).filter.subLog, 'false');
  assert.strictEqual(route.parseFilters('1s1', {logScope: 'sub'}).filter.subLog, 'true');
  assert.notOk('subLog' in route.parseFilters('1s1', {logScope: 'all'}).filter);
  assert.notOk('logScope' in route.parseFilters('1s1', {logScope: 'sub'}).filter);

  destroyOwned(route);
});

test('supports the complete text operator contract', function(assert) {
  let route = createOwned(ServiceLogRoute, {}, 'route');

  assert.deepEqual(route.parseFilters('1s1', {eventType: 'restart', eventTypeOperator: 'exact'}).filter,
    {serviceId: '1s1', eventType: 'restart'});
  assert.deepEqual(route.parseFilters('1s1', {eventType: 'restart', eventTypeOperator: 'notEqual'}).filter,
    {serviceId: '1s1', eventType_ne: 'restart'});
  assert.deepEqual(route.parseFilters('1s1', {description: 'failed', descriptionOperator: 'notContains'}).filter,
    {serviceId: '1s1', description_notlike: '%failed%'});
  assert.deepEqual(route.parseFilters('1s1', {description: '  '}).filter, {serviceId: '1s1'});

  destroyOwned(route);
});

test('invalidates stale polls and explicitly refreshes unchanged filter queries', function(assert) {
  let refreshes = 0;
  let route = createOwned(ServiceLogRoute, {
    controller: EmberObject.create(),
    pollGeneration: 4,
    timer: null,
    refresh() { refreshes++; },
  }, 'route');

  route.cancelLogUpdate();
  assert.strictEqual(route.get('pollGeneration'), 5);
  route.actions.filterLogs.call(route, {refreshIfUnchanged: true});
  assert.strictEqual(refreshes, 1);
  route.actions.filterLogs.call(route, {refreshIfUnchanged: false});
  assert.strictEqual(refreshes, 1);

  destroyOwned(route);
});
