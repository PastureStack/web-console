import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import AuditLogsRouteBase from 'ui/admin-tab/audit-logs/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

const AuditLogsRoute = AuditLogsRouteBase.extend({
  access: EmberObject.create({captureGeneration() { return 'initial-auth'; }}),
});

module('Unit | Route | admin tab | audit logs');

test('oversized query preserves the filter page without adopting an empty success collection', async function(assert) {
  let failure = {status: 422, body: {code: 'result_set_too_large', message: 'internal details'}};
  let projects = A([EmberObject.create({id: '1e1', name: 'Accessible environment'})]);
  let route = createOwned(AuditLogsRoute, {
    userStore: EmberObject.create({
      all() { return A(); },
      find(type) { return type === 'auditLog' ? reject(failure) : resolve(projects); },
    }),
  }, 'route');
  try {
    let model = await route.model({timeScope: 'all'});
    assert.strictEqual(model.get('auditLog'), null, 'failure is not represented as zero successful records');
    assert.strictEqual(model.get('projects'), projects, 'environment choices are retained for narrowing');
    assert.strictEqual(model.get('queryError.messageKey'), 'auditLogsPage.queryErrors.tooLarge');
    assert.ok(model.get('queryError.canNarrow'));
    route.set('controller', EmberObject.create({model}));
    route.scheduleLogUpdate();
    assert.strictEqual(route.get('timer'), null, 'failed queries do not start a retry storm');
  } finally {
    destroyOwned(route);
  }
});

test('authenticated failures still reject to the existing passive session recovery boundary', async function(assert) {
  let failure = {status: 401, body: {code: 'unauthorized'}};
  let route = createOwned(AuditLogsRoute, {
    userStore: EmberObject.create({
      all() { return A(); },
      find(type) { return type === 'auditLog' ? reject(failure) : resolve(A()); },
    }),
  }, 'route');
  try {
    await assert.rejects(route.model({}), (error) => error === failure, 'the exact 401 is not converted to query data');
  } finally {
    destroyOwned(route);
  }
});

test('successful query and an explicit retry retain ordinary results and the applied filters', async function(assert) {
  let auditLog = A([EmberObject.create({id: 'audit-row'})]);
  let captured;
  let refreshes = 0;
  let route = createOwned(AuditLogsRoute, {
    refresh() { refreshes++; return 'refreshed'; },
    userStore: EmberObject.create({
      all() { return A(); },
      find(type, id, options) { if (type === 'auditLog') { captured = options; } return resolve(type === 'auditLog' ? auditLog : A()); },
    }),
  }, 'route');
  try {
    let model = await route.model({timeScope: 'all', accountId: '1e1', eventType: 'change'});
    assert.strictEqual(model.get('auditLog'), auditLog);
    assert.strictEqual(model.get('queryError'), null);
    assert.deepEqual(captured.filter, {timeScope: 'all', accountId: '1e1', eventType_like: '%change%'});
    assert.strictEqual(route.actions.retryAuditQuery.call(route), 'refreshed');
    assert.strictEqual(refreshes, 1);
    assert.strictEqual(route.get('timer'), null, 'retry schedules no premature old-model poll');
  } finally {
    destroyOwned(route);
  }
});

test('late pagination failure cannot clear a newer successful query', async function(assert) {
  let response = defer();
  let oldModel = EmberObject.create({auditLog: EmberObject.create({followPagination() { return response.promise; }}), queryError: null});
  let newRows = A([EmberObject.create({id: 'new-result'})]);
  let newModel = EmberObject.create({auditLog: newRows, queryError: null});
  let route = createOwned(AuditLogsRoute, {controller: EmberObject.create({model: oldModel}), timer: null}, 'route');
  try {
    let pending = route.actions.next.call(route);
    route.cancelLogUpdate();
    route.controller.setProperties({model: newModel, isFiltering: false});
    response.reject({status: 422, body: {code: 'result_set_too_large'}});
    await pending;
    assert.strictEqual(newModel.get('auditLog'), newRows);
    assert.strictEqual(newModel.get('queryError'), null);
    assert.notOk(route.controller.get('isFiltering'));
  } finally {
    destroyOwned(route);
  }
});

test('current pagination failure ends loading once and keeps diagnostic recovery state', async function(assert) {
  let response = defer();
  let model = EmberObject.create({auditLog: EmberObject.create({followPagination() { return response.promise; }}), queryError: null});
  let route = createOwned(AuditLogsRoute, {controller: EmberObject.create({model}), timer: null}, 'route');
  try {
    let pending = route.actions.next.call(route);
    assert.ok(route.controller.get('isFiltering'));
    response.reject({status: 403});
    await pending;
    assert.strictEqual(model.get('auditLog'), null, 'no stale rows stay on screen after access is denied');
    assert.strictEqual(model.get('queryError.messageKey'), 'auditLogsPage.queryErrors.forbidden');
    assert.notOk(route.controller.get('isFiltering'));
    assert.strictEqual(route.get('timer'), null);
    let generation = route.get('pollGeneration');
    await route.actions.next.call(route);
    assert.strictEqual(route.get('pollGeneration'), generation + 1, 'error state makes no further pagination request');
  } finally {
    destroyOwned(route);
  }
});

test('late pagination success cannot replace a newer query or a different authenticated session', async function(assert) {
  for (let change of ['query', 'session', 'deactivate']) {
    let response = defer();
    let authGeneration = 'initial-auth';
    let original = EmberObject.create({followPagination() { return response.promise; }});
    let model = EmberObject.create({auditLog: original, queryError: null});
    let nextModel = EmberObject.create({auditLog: A([EmberObject.create({id: 'new-result'})]), queryError: null});
    let route = createOwned(AuditLogsRoute, {
      access: EmberObject.create({captureGeneration() { return authGeneration; }}),
      controller: EmberObject.create({model}),
    }, 'route');
    try {
      let pending = route.actions.next.call(route);
      if (change === 'query') {
        route.cancelLogUpdate();
        route.controller.setProperties({model: nextModel, isFiltering: false});
      } else if (change === 'session') {
        authGeneration = 'new-auth';
      } else {
        route.deactivate();
      }
      let currentRows = route.controller.get('model.auditLog');
      response.resolve(A([EmberObject.create({id: 'stale-private-result'})]));
      await pending;
      assert.strictEqual(route.controller.get('model.auditLog'), currentRows, `${change}: stale rows are not adopted`);
      assert.strictEqual(route.get('timer'), null, `${change}: no polling loop restarts`);
    } finally {
      destroyOwned(route);
    }
  }
});

test('a current passive 401 uses auth recovery while an old 401 is ignored', function(assert) {
  let errors = [];
  let model = EmberObject.create({auditLog: A(), queryError: null});
  let route = createOwned(AuditLogsRoute, {
    controller: EmberObject.create({model}), pollGeneration: 3,
    send(...args) { errors.push(args); },
  }, 'route');
  let failure = {status: 401};
  try {
    route.applyQueryFailure(failure, 2, model, 'old-auth');
    assert.deepEqual(errors, [], 'stale 401 cannot invalidate a new query');
    route.applyQueryFailure(failure, 3, model, 'initial-auth');
    assert.deepEqual(errors, [['sessionInvalid', null, true, null, 'initial-auth', 401]]);
    assert.strictEqual(model.get('queryError'), null, '401 is not displayed as a permission error');
  } finally {
    destroyOwned(route);
  }
});

test('late errors cannot clear data or dispatch auth recovery after the tab adopts a newer session', function(assert) {
  let rows = A([EmberObject.create({id: 'current-account-result'})]);
  let model = EmberObject.create({auditLog: rows, queryError: null});
  let sends = 0;
  let route = createOwned(AuditLogsRoute, {
    access: EmberObject.create({captureGeneration() { return 'new-auth'; }}),
    controller: EmberObject.create({model, isFiltering: false}), pollGeneration: 3,
    send() { sends++; },
  }, 'route');
  try {
    for (let status of [401, 403, 422]) {
      route.applyQueryFailure({status, body: {code: 'result_set_too_large'}}, 3, model, 'old-auth');
      assert.strictEqual(model.get('auditLog'), rows);
      assert.strictEqual(model.get('queryError'), null);
      assert.strictEqual(route.get('pollGeneration'), 3, 'the old failure cannot cancel new work');
    }
    assert.strictEqual(sends, 0);
  } finally {
    destroyOwned(route);
  }
});

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

test('forwards all-time intent while preserving dates, permissions and polling bounds', function(assert) {
  let route = createOwned(AuditLogsRoute, {}, 'route');
  let query = route.parseFilters({timeScope: 'all', accountId: '1a5'});

  assert.deepEqual(query.filter, {timeScope: 'all', accountId: '1a5'},
    'an all-time request reaches the permission-bound broker without invented dates');
  assert.strictEqual(query.url, 'pasturestack/audit-logs');
  assert.strictEqual(query.limit, 100);
  assert.strictEqual(query.depaginate, false);
  assert.deepEqual(route.parseFilters({}).filter, {}, 'the default still uses the broker 24-hour window');
  assert.deepEqual(route.parseFilters({timeScope: null}).filter, {}, 'an unset scope is omitted');
  assert.deepEqual(route.parseFilters({
    timeScope: 'all', createdFrom: '2026-09-01T00:00:00.000Z', createdTo: '2026-10-01T00:00:00.000Z',
  }).filter, {
    timeScope: 'all', created_gte: '2026-09-01T00:00:00.000Z', created_lte: '2026-10-01T00:00:00.000Z',
  }, 'explicit dates are never dropped when a bookmarked URL also contains all');
  assert.strictEqual(route.parseFilters({timeScope: 'invalid'}).filter.timeScope, 'invalid',
    'the authoritative broker can reject an invalid bookmarked scope instead of silently changing it');

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

test('refreshes only when unchanged query parameters cannot start a transition', function(assert) {
  let refreshes = 0;
  let route = createOwned(AuditLogsRoute, {
    controller: EmberObject.create(),
    refresh() {
      refreshes++;
    },
    timer: null,
    userHasPaged: true,
  }, 'route');

  route.actions.filterLogs.call(route, {refreshIfUnchanged: true});
  assert.strictEqual(refreshes, 1, 'an unchanged query gets one explicit refresh completion path');
  assert.notOk(route.get('userHasPaged'), 'a new filter query returns to the first result page');

  route.actions.filterLogs.call(route, {refreshIfUnchanged: false});
  assert.strictEqual(refreshes, 1, 'changed query parameters are not double refreshed');

  destroyOwned(route);
});
