import { module, test } from 'qunit';
import AuditLogsRoute from 'ui/admin-tab/audit-logs/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | admin tab | audit logs');

test('maps every visible filter to the GDAPI query contract', function(assert) {
  let route = createOwned(AuditLogsRoute, {}, 'route');
  let query = route.parseFilters({
    accountId: '1a5',
    authenticatedAsAccountId: '1a9',
    authType: 'ApiKey',
    clientIp: '10.0.0.25',
    createdFrom: '2026-08-28T01:00:00.000Z',
    createdTo: '2026-08-28T02:00:00.000Z',
    description: 'changed setting',
    descriptionOperator: 'exact',
    eventType: 'resource.',
    eventTypeOperator: 'startsWith',
    interactionChannel: 'public_api',
    resourceId: '1h7',
    resourceType: 'host',
    sortBy: 'created',
    sortOrder: 'asc',
  });

  assert.deepEqual(query, {
    depaginate: false,
    filter: {
      accountId: '1a5',
      authenticatedAsAccountId: '1a9',
      authType: 'ApiKey',
      clientIp: '10.0.0.25',
      created_gte: '2026-08-28T01:00:00.000Z',
      created_lte: '2026-08-28T02:00:00.000Z',
      description: 'changed setting',
      eventType_prefix: 'resource.',
      interactionChannel: 'public_api',
      resourceId: '1h7',
      resourceType: 'host',
    },
    forceReload: true,
    limit: 100,
    sortBy: 'created',
    sortOrder: 'asc',
    url: 'pasturestack/audit-logs',
  });

  destroyOwned(route);
});

test('supports useful text operators without leaking UI-only fields', function(assert) {
  let route = createOwned(AuditLogsRoute, {}, 'route');

  assert.deepEqual(route.parseFilters({eventType: 'change', eventTypeOperator: 'contains'}).filter,
    {eventType_like: '%change%'}, 'contains');
  assert.deepEqual(route.parseFilters({eventType: 'change', eventTypeOperator: 'notContains'}).filter,
    {eventType_notlike: '%change%'}, 'does not contain');
  assert.deepEqual(route.parseFilters({eventType: 'change', eventTypeOperator: 'notEqual'}).filter,
    {eventType_ne: 'change'}, 'is not');
  assert.deepEqual(route.parseFilters({eventType: '  ' , eventTypeOperator: 'exact'}).filter,
    {}, 'blank values are omitted');
  assert.notOk('eventTypeOperator' in route.parseFilters({eventType: 'change'}).filter,
    'the presentation-only operator never reaches GDAPI');
  assert.strictEqual(route.parseFilters({interactionChannel: 'web_ui'}).filter.interactionChannel,
    'web_ui', 'interaction channel is forwarded to the permission-bound endpoint');

  destroyOwned(route);
});

test('invalidates an older polling generation whenever a new filter query takes control', function(assert) {
  let route = createOwned(AuditLogsRoute, {pollGeneration: 7, timer: null}, 'route');

  route.cancelLogUpdate();

  assert.strictEqual(route.get('pollGeneration'), 8,
    'an already-running stale response can no longer replace the newly filtered table');
  assert.strictEqual(route.get('timer'), null);

  destroyOwned(route);
});
