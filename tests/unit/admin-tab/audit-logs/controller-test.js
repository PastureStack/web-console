import { A } from '@ember/array';
import EmberObject from '@ember/object';
import moment from 'moment';
import { module, test } from 'qunit';
import AuditLogsController from 'ui/admin-tab/audit-logs/controller';
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
    send() {},
  }, properties), 'controller');
}

module('Unit | Controller | admin tab | audit logs');

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
