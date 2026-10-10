import { A } from '@ember/array';
import EmberObject from '@ember/object';
import moment from 'moment';
import { defer, reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import AuditLogsController from 'ui/admin-tab/audit-logs/controller';
import installBootstrapRuntime from 'ui/utils/bootstrap-runtime';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

function auditLogFor(records = [], actors = []) {
  let auditLog = A(records);

  auditLog.set('filters', EmberObject.create({
    suggestions: EmberObject.create({
      actors: A(actors),
      clientIps: A(),
      eventTypes: A(),
      resourceTypes: A(),
    }),
  }));
  auditLog.set('pagination', EmberObject.create({total: records.length}));
  return auditLog;
}

function controllerFor(properties = {}) {
  return createOwned(AuditLogsController, Object.assign({
    intl: EmberObject.create({
      t(key) {
        return key;
      },
    }),
    model: EmberObject.create({
      auditLog: auditLogFor(),
      projects: A(),
      resourceTypes: A(),
    }),
    access: EmberObject.create({captureGeneration() { return 'initial-auth'; }}),
    userStore: EmberObject.create({headers: {}}),
    send() {},
  }, properties), 'controller');
}

module('Unit | Controller | admin tab | audit logs', {
  beforeEach() {
    this.previousBootstrap = window.bootstrap;
    // Owned unit fixtures do not boot app.js. Install the same maintained
    // runtime used by production, rather than mocking Dropdown behavior.
    installBootstrapRuntime();
  },
  afterEach() {
    window.bootstrap = this.previousBootstrap;
  },
});

test('native export dropdown closes before its toggle is disabled across consecutive formats', async function(assert) {
  let host = document.createElement('div');
  host.className = 'dropdown';
  let button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-bs-toggle', 'dropdown');
  button.setAttribute('data-testid', 'audit-log-export');
  let menu = document.createElement('ul');
  menu.className = 'dropdown-menu';
  host.append(button, menu);
  document.body.appendChild(host);
  let dropdown = window.bootstrap.Dropdown.getOrCreateInstance(button);
  let deferred;
  let requests = 0;
  let downloads = 0;
  let controller = controllerFor({
    fetchAuditExport() { requests++; return deferred.promise; },
    saveAuditExport() { downloads++; },
  });
  let renderDisabled = () => { button.disabled = controller.get('isExporting'); };
  controller.addObserver('isExporting', renderDisabled);
  try {
    for (let format of ['json', 'csv', 'xlsx']) {
      dropdown.show();
      assert.strictEqual(button.getAttribute('aria-expanded'), 'true', `${format} starts with the real menu open`);
      deferred = defer();
      let pending = controller.actions.exportLogs.call(controller, format);
      assert.ok(button.disabled, 'the export lock is rendered immediately');
      assert.strictEqual(button.getAttribute('aria-expanded'), 'false', 'the menu closes before Bootstrap sees a disabled toggle');
      assert.notOk(menu.classList.contains('show'));
      assert.strictEqual(controller.actions.exportLogs.call(controller, format), undefined, 'a duplicate cannot start another export');
      deferred.resolve(new Blob(['safe test export']));
      await pending;
      assert.notOk(button.disabled);
    }
    assert.strictEqual(requests, 3);
    assert.strictEqual(downloads, 3);
  } finally {
    controller.removeObserver('isExporting', renderDisabled);
    destroyOwned(controller);
    dropdown.dispose();
    host.remove();
  }
});

test('query recovery narrows time only after an explicit action and preserves all other filters', function(assert) {
  let sent = [];
  let controller = controllerFor({
    timeScope: 'all',
    send(action, options) { sent.push({action, options}); },
  });
  try {
    controller.syncDraftFromQuery();
    controller.setProperties({
      'filters.accountId': '1e1',
      'filters.authenticatedAsAccountId': '1a1',
      'filters.eventType': 'update',
      'filters.interactionChannel': 'public_api',
      'model.queryError': {messageKey: 'auditLogsPage.queryErrors.tooLarge', canNarrow: true},
    });
    assert.strictEqual(controller.get('filters.createdFrom'), null, 'a failure never silently changes all-time intent');
    controller.actions.queryRecentMinutes.call(controller);
    assert.strictEqual(moment(controller.get('createdTo')).diff(moment(controller.get('createdFrom')), 'minutes'), 15);
    assert.strictEqual(controller.get('timeScope'), null);
    assert.strictEqual(controller.get('accountId'), '1e1');
    assert.strictEqual(controller.get('authenticatedAsAccountId'), '1a1');
    assert.strictEqual(controller.get('eventType'), 'update');
    assert.strictEqual(controller.get('interactionChannel'), 'public_api');
    assert.deepEqual(sent, [{action: 'filterLogs', options: {refreshIfUnchanged: false}}]);
  } finally {
    destroyOwned(controller);
  }
});

test('a rejected, pending or duplicate query cannot start a misleading export', async function(assert) {
  let requests = 0;
  let downloads = 0;
  let hides = 0;
  let controller = controllerFor({
    closeAuditExportDropdown() { hides++; },
    fetchAuditExport() { requests++; return resolve(new Blob(['safe export'])); },
    saveAuditExport() { downloads++; },
  });
  try {
    controller.set('model.queryError', {messageKey: 'auditLogsPage.queryErrors.tooLarge'});
    await controller.actions.exportLogs.call(controller, 'json');
    controller.setProperties({'model.queryError': null, isFiltering: true});
    await controller.actions.exportLogs.call(controller, 'json');
    controller.setProperties({isFiltering: false, isExporting: true});
    await controller.actions.exportLogs.call(controller, 'json');
    controller.set('isExporting', false);
    await controller.actions.exportLogs.call(controller, 'html');
    assert.strictEqual(requests, 0, 'all guards stop the real transport entry point');
    assert.strictEqual(downloads, 0, 'no blocked request delivers a file');
    assert.strictEqual(hides, 0, 'blocked exports do not change dropdown state');
    assert.notOk(controller.get('isExporting'));
  } finally {
    destroyOwned(controller);
  }
});

test('export menu closure never creates an instance or changes another dropdown', function(assert) {
  let host = document.createElement('div');
  host.innerHTML = '<div class="dropdown"><button data-bs-toggle="dropdown" data-testid="audit-log-export"></button><ul class="dropdown-menu"></ul></div>' +
    '<div class="dropdown"><button data-bs-toggle="dropdown"></button><ul class="dropdown-menu"></ul></div>';
  document.body.appendChild(host);
  let buttons = host.querySelectorAll('button');
  let other = window.bootstrap.Dropdown.getOrCreateInstance(buttons[1]);
  let controller = controllerFor();
  try {
    other.show();
    controller.closeAuditExportDropdown();
    assert.strictEqual(window.bootstrap.Dropdown.getInstance(buttons[0]), null, 'no instance is created for the export toggle');
    assert.strictEqual(buttons[1].getAttribute('aria-expanded'), 'true', 'other dropdown ownership is unchanged');
  } finally {
    other.dispose();
    destroyOwned(controller);
    host.remove();
  }
});

test('missing names never misrepresent a retained actor or environment filter as all', function(assert) {
  let controller = controllerFor();
  try {
    controller.setProperties({'filters.accountId': '1e1', 'filters.authenticatedAsAccountId': '1a1',
      'model.auditLog': null, 'model.queryError': {messageKey: 'auditLogsPage.queryErrors.tooLarge'}});
    assert.strictEqual(controller.get('userSelectionSummary'), 'auditLogsPage.queryErrors.selectedUserUnavailable');
    assert.strictEqual(controller.get('environmentSelectionSummary'), 'auditLogsPage.queryErrors.selectedEnvironmentUnavailable');
    assert.strictEqual(controller.get('filters.authenticatedAsAccountId'), '1a1');
    assert.strictEqual(controller.get('filters.accountId'), '1e1');
  } finally { destroyOwned(controller); }
});

test('checked export errors are visible without delivering an error body as a file', async function(assert) {
  let controller = controllerFor({saveAuditExport() { assert.notOk(true, 'failed exports must not deliver files'); }});
  try {
    let model = controller.get('model');
    let rows = model.get('auditLog');
    for (let [status, code, message] of [[422, 'export_too_large', 'exportTooLarge'],
      [403, 'denied', 'exportForbidden'], [502, 'upstream_failed', 'exportUnavailable']]) {
      controller.fetchAuditExport = () => reject({status, body: {code}});
      await controller.actions.exportLogs.call(controller, 'json');
      assert.strictEqual(controller.get('exportError.messageKey'), `auditLogsPage.queryErrors.${message}`);
      assert.notOk(controller.get('isExporting'), 'a failed export releases its own lock');
      assert.notOk(controller.get('model.queryError'), 'an export failure is not a fake list-query failure');
      assert.strictEqual(controller.get('model'), model, 'an export failure does not replace the successful model');
      assert.strictEqual(controller.get('model.auditLog'), rows, 'successful list rows are retained');
    }
    controller.fetchAuditExport = () => reject(new TypeError('synthetic network failure'));
    await controller.actions.exportLogs.call(controller, 'json');
    assert.strictEqual(controller.get('exportError.messageKey'), 'auditLogsPage.queryErrors.exportUnavailable');
    assert.strictEqual(controller.get('model.auditLog'), rows, 'network failure also retains successful rows');
    assert.notOk(controller.get('model.queryError'));
    assert.notOk(controller.get('isExporting'));
  } finally { destroyOwned(controller); }
});

test('exports have one owner, are awaitable and cannot leak a file to a newer session', async function(assert) {
  let deferred = defer();
  let requests = 0;
  let downloads = 0;
  let auth = 'initial-auth';
  let controller = controllerFor({
    access: EmberObject.create({captureGeneration() { return auth; }}),
    fetchAuditExport() { requests++; return deferred.promise; },
    saveAuditExport() { downloads++; },
  });
  try {
    let pending = controller.actions.exportLogs.call(controller, 'json');
    assert.ok(pending && typeof pending.then === 'function', 'the complete export is awaitable');
    assert.strictEqual(controller.actions.exportLogs.call(controller, 'json'), undefined, 'duplicate click does not start another request');
    auth = 'new-auth';
    deferred.resolve(new Blob(['old-session export']));
    await pending;
    assert.strictEqual(requests, 1);
    assert.strictEqual(downloads, 0, 'old authorization result cannot deliver to a new session');
    assert.strictEqual(controller.get('exportError'), null);
    assert.notOk(controller.get('isExporting'));
  } finally { destroyOwned(controller); }
});

test('export 401 delegates passive recovery with captured generation and never server logout', async function(assert) {
  let actions = [];
  let controller = controllerFor({
    fetchAuditExport() { return reject({status: 401}); },
    send(...args) { actions.push(args); },
  });
  try {
    await controller.actions.exportLogs.call(controller, 'csv');
    assert.deepEqual(actions, [['sessionInvalid', null, true, null, 'initial-auth', 401]]);
    assert.strictEqual(controller.get('exportError'), null);
    assert.notOk(controller.get('isExporting'));
  } finally { destroyOwned(controller); }
});

test('file delivery exceptions use the same diagnostic cleanup as network failures', async function(assert) {
  let controller = controllerFor({
    fetchAuditExport() { return resolve(new Blob(['safe export'])); },
    saveAuditExport() { throw new Error('delivery failed'); },
  });
  try {
    await controller.actions.exportLogs.call(controller, 'json');
    assert.strictEqual(controller.get('exportError.messageKey'), 'auditLogsPage.queryErrors.exportUnavailable');
    assert.notOk(controller.get('isExporting'));
  } finally { destroyOwned(controller); }
});

test('export parser checks HTTP and file type before returning binary data', async function(assert) {
  let controller = controllerFor();
  try {
    for (let type of ['application/json', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) {
      let blob = new Blob(['safe fixture'], {type});
      let response = {status: 200, headers: new Headers({'Content-Type': type + '; charset=utf-8'}), blob() { return resolve(blob); }};
      assert.strictEqual(await controller.readAuditExportResponse(response, type), blob);
    }
    await assert.rejects(controller.readAuditExportResponse({status: 422,
      headers: new Headers({'Content-Type': 'application/json'}), json() { return resolve({code: 'export_too_large'}); }}, 'text/csv'),
    (error) => error.status === 422 && error.body.code === 'export_too_large');
    await assert.rejects(controller.readAuditExportResponse({status: 200,
      headers: new Headers({'Content-Type': 'text/html'})}, 'text/csv'), (error) => error.status === 502, 'unexpected HTML is never downloaded');
  } finally { destroyOwned(controller); }
});

test('all-time JSON and XLSX exports use the same scope and authorization filters as the list', async function(assert) {
  let captured;
  let downloads = 0;
  let controller = controllerFor({
    timeScope: 'all', accountId: '1e1', authenticatedAsAccountId: '1a1',
    createdFrom: null, createdTo: null, eventType: 'resource.', eventTypeOperator: 'startsWith',
    fetchAuditExport(url) { captured = url; return resolve(new Blob(['safe export'])); },
    saveAuditExport() { downloads++; },
  });

  for (let format of ['json', 'xlsx']) {
    try {
      await controller.actions.exportLogs.call(controller, format);
      let query = new URL(captured, window.location.origin);
      assert.strictEqual(query.pathname, '/v2-beta/pasturestack/audit-logs/export');
      assert.strictEqual(query.searchParams.get('timeScope'), 'all', `${format} preserves all-time intent`);
      assert.strictEqual(query.searchParams.get('format'), format);
      assert.strictEqual(query.searchParams.get('accountId'), '1e1');
      assert.strictEqual(query.searchParams.get('authenticatedAsAccountId'), '1a1');
      assert.strictEqual(query.searchParams.get('eventType_prefix'), 'resource.');
      assert.notOk(query.searchParams.has('created_gte'), 'no artificial start date');
      assert.notOk(query.searchParams.has('created_lte'), 'no artificial end date');

      controller.setProperties({createdFrom: '2026-09-01T00:00:00.000Z', createdTo: '2026-10-01T00:00:00.000Z'});
      await controller.actions.exportLogs.call(controller, format);
      query = new URL(captured, window.location.origin);
      assert.strictEqual(query.searchParams.get('created_gte'), controller.get('createdFrom'));
      assert.strictEqual(query.searchParams.get('created_lte'), controller.get('createdTo'));
      controller.setProperties({timeScope: null, createdFrom: null, createdTo: null});
      await controller.actions.exportLogs.call(controller, format);
      query = new URL(captured, window.location.origin);
      assert.notOk(query.searchParams.has('timeScope'), 'the normal default is not promoted to all time');
      controller.set('timeScope', 'all');
    } finally {
      assert.notOk(controller.get('isExporting'), 'completion releases the export lock');
    }
  }
  assert.strictEqual(downloads, 6, 'each checked success delivers exactly one file');

  destroyOwned(controller);
});

test('a bookmarked all-time marker does not hide explicit date bounds in the draft', function(assert) {
  let controller = controllerFor({
    timeScope: 'all', createdFrom: '2026-09-01T00:00:00.000Z', createdTo: '2026-10-01T00:00:00.000Z',
  });
  controller.syncDraftFromQuery();
  assert.strictEqual(moment(controller.get('filters.createdFrom')).toISOString(), controller.get('createdFrom'));
  assert.strictEqual(moment(controller.get('filters.createdTo')).toISOString(), controller.get('createdTo'));
  assert.notEqual(controller.get('activeTimePreset'), 'all', 'the displayed range agrees with the API query');
  destroyOwned(controller);
});

test('offers friendly environment and user names without raw ID fallbacks', function(assert) {
  let controller = controllerFor({
    model: EmberObject.create({
      auditLog: auditLogFor([], [
        {id: '1a1', label: '陳管理員'},
        {id: '1a2', label: 'alice'},
        {id: '1a3', label: ''},
        {id: '1a4', label: '1a4'},
      ]),
      projects: A([
        EmberObject.create({id: '1e1', type: 'project', displayName: '正式環境'}),
        EmberObject.create({id: '1e2', type: 'project', displayName: '', name: '測試環境'}),
        EmberObject.create({id: '1e4', type: 'project', displayName: '', name: ''}),
        EmberObject.create({id: '1e3', type: 'environment', displayName: '不應出現'}),
      ]),
      resourceTypes: A(),
    }),
  });

  assert.deepEqual(controller.get('environmentOptions').map((item) => item.get('label')).sort(),
    ['正式環境', '測試環境'].sort(), 'named projects use a human label and blank projects are omitted');
  assert.deepEqual(controller.get('userOptions').map((item) => item.get('label')).sort(),
    ['alice', '陳管理員'].sort(), 'only human actors returned by the permission-scoped audit query are offered');
  assert.notOk(controller.get('environmentOptions').some((item) => /^1e/.test(item.get('label'))),
    'an internal project ID is never used as a label');
  assert.notOk(controller.get('userOptions').some((item) => /^1a/.test(item.get('label'))),
    'an internal account ID is never used as a label');

  destroyOwned(controller);
});

test('waits for active locales before translating authentication choices', function(assert) {
  let translations = 0;
  let intl = EmberObject.create({
    _locale: [],
    t(key) {
      translations++;
      return key;
    },
  });
  let controller = controllerFor({intl});

  assert.strictEqual(translations, 0, 'controller initialization does not translate before setLocale');
  assert.deepEqual(controller.get('authTypes'), [], 'authentication choices start in a safe empty state');

  intl.set('_locale', ['zh-tw', 'en-us']);

  assert.strictEqual(translations, 4, 'locale activation populates every visible authentication type once');
  assert.strictEqual(controller.get('authTypes.length'), 4, 'the choices are ready after locale activation');

  destroyOwned(controller);
});

test('restores query parameters into the editable condition builder', function(assert) {
  let controller = controllerFor({
    accountId: '1e1',
    authenticatedAsAccountId: '1a1',
    authType: 'ApiKey',
    description: 'changed',
    descriptionOperator: 'exact',
    eventType: 'resource.',
    eventTypeOperator: 'startsWith',
    resourceType: 'host',
  });

  controller.syncDraftFromQuery();

  assert.strictEqual(controller.get('filters.accountId'), '1e1');
  assert.strictEqual(controller.get('filters.authenticatedAsAccountId'), '1a1');
  assert.deepEqual(controller.get('optionalFilters').toArray(),
    ['eventType', 'description', 'resource', 'authType']);
  assert.strictEqual(controller.get('filters.eventTypeOperator'), 'startsWith');
  assert.strictEqual(controller.get('filters.descriptionOperator'), 'exact');

  destroyOwned(controller);
});

test('adds each optional condition once and removes its value with the row', function(assert) {
  let controller = controllerFor();

  controller.actions.addFilter.call(controller, 'eventType');
  controller.actions.addFilter.call(controller, 'eventType');
  controller.actions.addFilter.call(controller, 'description');
  controller.set('filters.eventType', 'resource.change');

  assert.deepEqual(controller.get('optionalFilters').toArray(), ['eventType', 'description'],
    'the same field cannot be added twice');

  controller.actions.removeFilter.call(controller, 'eventType');

  assert.deepEqual(controller.get('optionalFilters').toArray(), ['description'],
    'removing a row leaves unrelated conditions intact');
  assert.strictEqual(controller.get('filters.eventType'), null,
    'removing a row also removes its query value');

  destroyOwned(controller);
});

test('stores text operators in the query-backed draft', function(assert) {
  let controller = controllerFor();

  controller.actions.selectTextOperator.call(controller, 'eventType', {target: {value: 'exact'}});
  controller.actions.selectTextOperator.call(controller, 'description', 'notContains');

  assert.strictEqual(controller.get('filters.eventTypeOperator'), 'exact',
    'event type operator is ready for query serialization');
  assert.strictEqual(controller.get('filters.descriptionOperator'), 'notContains',
    'description operator is ready for query serialization');

  controller.actions.selectTextOperator.call(controller, 'unknown', 'exact');
  assert.notOk(controller.get('filters.unknownOperator'), 'unknown fields cannot create draft state');
  controller.actions.selectTextOperator.call(controller, 'eventType', {target: {value: 'not-an-operator'}});
  assert.strictEqual(controller.get('filters.eventTypeOperator'), 'exact',
    'invalid browser values cannot replace a valid operator');

  destroyOwned(controller);
});

test('applies a valid local time range and blocks inverted, empty, or zero-width ranges', function(assert) {
  let sent = [];
  let controller = controllerFor({
    send(name) {
      sent.push(name);
    },
  });

  controller.set('filters.createdFrom', '2026-08-28T09:00:00');
  controller.set('filters.createdTo', '2026-08-28T10:00:00');
  controller.actions.search.call(controller);

  assert.strictEqual(controller.get('createdFrom'), moment('2026-08-28T09:00:00').toISOString(),
    'the local start is serialized as an unambiguous instant');
  assert.strictEqual(controller.get('createdTo'), moment('2026-08-28T10:00:00').toISOString(),
    'the local end is serialized as an unambiguous instant');
  assert.deepEqual(sent, ['filterLogs'], 'a valid filter refreshes the logs once');

  sent.length = 0;
  controller.set('filters.createdFrom', '2026-08-28T11:00:00');
  controller.set('filters.createdTo', '2026-08-28T10:00:00');
  controller.actions.search.call(controller);

  assert.deepEqual(sent, [], 'an inverted range is not sent');
  assert.strictEqual(controller.get('filterError'), 'auditLogsPage.filterBuilder.rangeError');

  sent.length = 0;
  controller.set('filters.createdFrom', null);
  controller.set('filters.createdTo', '2026-08-28T10:00:00');
  controller.actions.search.call(controller);

  assert.deepEqual(sent, [], 'a one-sided time range is not sent');

  controller.set('filters.createdFrom', '2026-08-28T10:00:00');
  controller.set('filters.createdTo', '2026-08-28T10:00:00');
  controller.actions.search.call(controller);

  assert.deepEqual(sent, [], 'an empty half-open time range is not sent');

  destroyOwned(controller);
});

test('supports the one-month and all-time quick ranges', function(assert) {
  let controller = controllerFor();

  controller.actions.setTimePreset.call(controller, 1, 'month');
  let from = moment(controller.get('filters.createdFrom'));
  let to = moment(controller.get('filters.createdTo'));

  assert.ok(from.clone().add(1, 'month').isSame(to), 'one month follows calendar boundaries');
  assert.strictEqual(controller.get('activeTimePreset'), 'month');

  controller.actions.setAllTimePreset.call(controller);
  assert.strictEqual(controller.get('filters.createdFrom'), null);
  assert.strictEqual(controller.get('filters.createdTo'), null);
  assert.strictEqual(controller.get('timeRangeSummary'), 'auditLogsPage.filterBuilder.presets.allTime');
  assert.strictEqual(controller.get('activeTimePreset'), 'all');
  assert.notOk(controller.get('timeRangeInvalid'), 'all time remains a valid query range');

  controller.actions.search.call(controller);
  assert.strictEqual(controller.get('timeScope'), 'all',
    'the unbounded choice has explicit query state instead of looking like an initial visit');

  controller.syncDraftFromQuery();
  assert.strictEqual(controller.get('filters.createdFrom'), null,
    'the explicit all-time state survives route setup');
  assert.strictEqual(controller.get('filters.createdTo'), null,
    'route setup does not silently restore the default 24-hour range');

  destroyOwned(controller);
});

test('keeps an initial visit bounded while preserving an explicit all-time query', function(assert) {
  let initial = controllerFor();

  initial.syncDraftFromQuery();
  assert.strictEqual(moment(initial.get('filters.createdTo')).diff(moment(initial.get('filters.createdFrom')), 'hours'), 24,
    'an initial visit still uses the safe 24-hour default');
  destroyOwned(initial);

  let allTime = controllerFor({timeScope: 'all'});

  allTime.syncDraftFromQuery();
  assert.strictEqual(allTime.get('filters.createdFrom'), null);
  assert.strictEqual(allTime.get('filters.createdTo'), null);
  assert.strictEqual(allTime.get('activeTimePreset'), 'all');
  destroyOwned(allTime);
});

test('forces a refresh when applying an unchanged query instead of leaving the loading state stuck', function(assert) {
  let sent = [];
  let controller = controllerFor({
    send(name, options) {
      sent.push({name, options});
    },
  });

  controller.set('eventType', null);
  controller.runFilterQuery({eventType: null});

  assert.deepEqual(sent, [{name: 'filterLogs', options: {refreshIfUnchanged: true}}],
    'an unchanged query asks the route for one explicit refresh');
  assert.ok(controller.get('isFiltering'), 'the loading state is owned by the refresh lifecycle');

  sent.length = 0;
  controller.runFilterQuery({eventType: 'api.'});

  assert.deepEqual(sent, [{name: 'filterLogs', options: {refreshIfUnchanged: false}}],
    'a changed query relies on its query-parameter transition and does not double refresh');

  destroyOwned(controller);
});

test('clears optional conditions while applying the visible default 24 hour range', function(assert) {
  let sent = [];
  let controller = controllerFor({
    accountId: '1e1',
    createdFrom: null,
    createdTo: null,
    eventType: 'api.',
    send(name, options) {
      sent.push({name, options});
    },
  });

  controller.set('filters.eventType', 'api.');
  controller.get('optionalFilters').pushObject('eventType');
  controller.actions.clearAll.call(controller);

  assert.strictEqual(controller.get('eventType'), null, 'the optional event condition is cleared');
  assert.deepEqual(controller.get('optionalFilters').toArray(), [], 'optional condition rows are cleared');
  assert.ok(controller.get('createdFrom'), 'clear applies the start shown in the default time control');
  assert.ok(controller.get('createdTo'), 'clear applies the end shown in the default time control');
  assert.strictEqual(moment(controller.get('createdTo')).diff(moment(controller.get('createdFrom')), 'hours'), 24,
    'the backend query remains bounded to the same visible 24 hour range');
  assert.deepEqual(sent, [{name: 'filterLogs', options: {refreshIfUnchanged: false}}],
    'the bounded clear query starts exactly one query-parameter refresh');

  destroyOwned(controller);
});

test('offers WebUI/API as a primary filter and defaults to a bounded 24 hour range', function(assert) {
  let controller = controllerFor();
  let start = moment(controller.get('filters.createdFrom'));
  let end = moment(controller.get('filters.createdTo'));

  assert.strictEqual(end.diff(start, 'hours'), 24, 'the initial incident view is bounded to 24 hours');
  assert.deepEqual(controller.get('interactionChannels').map((item) => item.get('key')),
    ['web_ui', 'public_api', 'automation', 'system_internal', 'unknown']);

  controller.actions.addFilter.call(controller, 'interactionChannel');
  assert.notOk(controller.get('optionalFilters').includes('interactionChannel'),
    'the operation source remains a fixed primary control instead of a duplicate optional row');
  controller.actions.updateInteractionChannel.call(controller, controller.get('interactionChannels')[1]);
  controller.actions.search.call(controller);

  assert.strictEqual(controller.get('interactionChannel'), 'public_api',
    'the selected API channel is serialized independently from the user');

  destroyOwned(controller);
});

test('maps local date-times to the three visible hour, minute, and period columns', function(assert) {
  let controller = controllerFor();

  controller.set('filters.createdFrom', '2026-08-28T00:07:31');
  controller.set('filters.createdTo', '2026-08-28T12:46:52');

  assert.strictEqual(controller.get('createdFromDate'), '2026-08-28');
  assert.strictEqual(controller.get('createdFromHour'), 12, 'midnight is shown as 12 AM');
  assert.strictEqual(controller.get('createdFromMinute'), 7);
  assert.strictEqual(controller.get('createdFromPeriod'), 'am');
  assert.strictEqual(controller.get('createdToHour'), 12, 'noon is shown as 12 PM');
  assert.strictEqual(controller.get('createdToMinute'), 46);
  assert.strictEqual(controller.get('createdToPeriod'), 'pm');

  destroyOwned(controller);
});

test('updates each of the three time columns without changing the date or seconds', function(assert) {
  let controller = controllerFor();

  controller.set('filters.createdFrom', '2026-08-28T23:07:31');
  controller.actions.setTimePart.call(controller, 'createdFrom', 'hour', 3);
  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T15:07:31',
    'hour selection retains PM and preserves the exact date and seconds');

  controller.actions.setTimePart.call(controller, 'createdFrom', 'minute', 46);
  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T15:46:31');

  controller.actions.setTimePart.call(controller, 'createdFrom', 'period', 'am');
  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T03:46:31');

  controller.actions.setTimePart.call(controller, 'createdFrom', 'hour', 12);
  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T00:46:31',
    '12 AM maps to midnight without changing other parts');
  assert.strictEqual(controller.get('activeTimePreset'), 'custom');

  destroyOwned(controller);
});

test('changes the date independently and rejects invalid wheel values', function(assert) {
  let controller = controllerFor();

  controller.set('filters.createdTo', '2026-08-28T18:46:52');
  controller.set('createdToDate', '2026-09-02');

  assert.strictEqual(controller.get('filters.createdTo'), '2026-09-02T18:46:52',
    'calendar changes preserve the selected time down to seconds');
  assert.notOk(controller.updateTimePart('createdTo', 'minute', 60));
  assert.notOk(controller.updateTimePart('createdTo', 'hour', 0));
  assert.notOk(controller.updateTimePart('createdTo', 'period', 'night'));
  assert.strictEqual(controller.get('filters.createdTo'), '2026-09-02T18:46:52',
    'invalid wheel values cannot corrupt the query range');

  destroyOwned(controller);
});
