import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { later } from '@ember/runloop';
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

  controller.actions.selectTextOperator.call(controller, 'eventType', 'exact');
  controller.actions.selectTextOperator.call(controller, 'description', 'notContains');

  assert.strictEqual(controller.get('filters.eventTypeOperator'), 'exact',
    'event type operator is ready for query serialization');
  assert.strictEqual(controller.get('filters.descriptionOperator'), 'notContains',
    'description operator is ready for query serialization');

  controller.actions.selectTextOperator.call(controller, 'unknown', 'exact');
  assert.notOk(controller.get('filters.unknownOperator'), 'unknown fields cannot create draft state');

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

test('tweens both time wheels before committing every queued 15-minute step', function(assert) {
  let controller = controllerFor();
  let prevented = 0;

  controller.set('filters.createdFrom', '2026-08-28T10:00:00');
  controller.actions.nudgeTime.call(controller, 'createdFrom', {
    deltaY: 120,
    preventDefault() {
      prevented++;
    },
  });

  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T10:00:00',
    'the selected value is retained while the old rows visibly travel to the next position');
  assert.true(controller.get('timeWheelAnimating'));
  assert.strictEqual(controller.get('timeWheelDirection'), 'next');
  assert.strictEqual(controller.get('createdFromWheelOptions.length'), 7,
    'one buffered row exists outside each edge of the five-row viewport');
  assert.strictEqual(controller.get('createdFromWheelOptions')[3].label, '2026/08/28 10:00',
    'the old selected row remains centered until animationend');

  controller.actions.finishTimeWheelAnimation.call(controller, 'createdFrom');

  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T10:15:00',
    'animationend atomically commits the row which reached the center');
  assert.strictEqual(controller.get('createdFromWheelOptions')[3].label, '2026/08/28 10:15',
    'the committed selected time is centered without a visual jump');

  let firstPhase = controller.get('timeWheelPhase');
  for (let index = 0; index < 200; index++) {
    controller.actions.nudgeTime.call(controller, 'createdFrom', {
      deltaY: -1,
      preventDefault() {
        prevented++;
      },
    });
  }

  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T10:15:00',
    'rapid wheel events queue without skipping their interpolation');
  assert.strictEqual(controller.get('timeWheelPendingSteps'), -199,
    'the active step is separate from the remaining animation queue');

  for (let index = 0; index < 200; index++) {
    controller.actions.finishTimeWheelAnimation.call(controller, 'createdFrom');
  }

  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-26T08:15:00',
    'the virtual wheel keeps generating earlier slots instead of reaching a list boundary');
  assert.strictEqual(controller.get('timeWheelDirection'), 'previous');
  assert.strictEqual(controller.get('timeWheelPhase'), firstPhase,
    'the alternating phase remains deterministic across repeated wheel animation cycles');
  assert.notOk(controller.get('timeWheelAnimating'), 'the track returns to its stable center after the queue drains');
  assert.strictEqual(prevented, 201, 'page scrolling is consumed only by valid time-wheel movements');

  destroyOwned(controller);
});

test('queues keyboard page steps on the end-time wheel and flushes them when accepted', function(assert) {
  let controller = controllerFor();

  controller.set('filters.createdFrom', '2026-08-28T09:00:00');
  controller.set('filters.createdTo', '2026-08-28T10:00:00');
  controller.set('isTimePickerOpen', true);
  controller.actions.keyTimeWheel.call(controller, 'createdTo', {
    key: 'PageDown',
    preventDefault() {},
  });

  assert.strictEqual(controller.get('timeWheelActiveStep'), 1);
  assert.strictEqual(controller.get('timeWheelPendingSteps'), 3,
    'PageDown is four visible one-row tween stages instead of a value jump');

  controller.actions.acceptTimePicker.call(controller);

  assert.strictEqual(controller.get('filters.createdTo'), '2026-08-28T11:00:00',
    'accepting during a tween preserves the complete intended one-hour movement');
  assert.notOk(controller.get('timeWheelAnimating'));
  assert.notOk(controller.get('isTimePickerOpen'));

  destroyOwned(controller);
});

test('finishes a wheel step when the browser does not deliver animationend', function(assert) {
  let done = assert.async();
  let controller = controllerFor();

  controller.set('filters.createdFrom', '2026-08-28T10:00:00');
  controller.shiftTimeWheel('createdFrom', 1);

  assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T10:00:00',
    'the fallback does not skip the visible tween');

  later(() => {
    assert.strictEqual(controller.get('filters.createdFrom'), '2026-08-28T10:15:00',
      'the bounded fallback commits exactly one step when animationend is absent');
    assert.notOk(controller.get('timeWheelAnimating'));
    destroyOwned(controller);
    done();
  }, 340);
});
