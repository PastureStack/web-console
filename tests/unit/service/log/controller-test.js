import { A } from '@ember/array';
import EmberObject from '@ember/object';
import moment from 'moment';
import { module, test } from 'qunit';
import ServiceLogController from 'ui/service/log/controller';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

function controllerFor(properties = {}) {
  let logs = A();

  logs.set('pagination', EmberObject.create({}));
  return createOwned(ServiceLogController, Object.assign({
    intl: EmberObject.create({
      _locale: ['en-us'],
      t(key) { return key; },
    }),
    model: EmberObject.create({
      logs,
      service: EmberObject.create({instances: A()}),
    }),
    send() {},
  }, properties), 'controller');
}

module('Unit | Controller | service | log');

test('offers human container names and never falls back to internal IDs', function(assert) {
  let controller = controllerFor({
    model: EmberObject.create({
      logs: A(),
      service: EmberObject.create({instances: A([
        EmberObject.create({id: '1i1', displayName: 'web-1'}),
        EmberObject.create({id: '1i2', name: 'worker-1'}),
        EmberObject.create({id: '1i3', displayName: '', name: ''}),
      ])}),
    }),
  });

  assert.deepEqual(controller.get('instanceOptions').map((item) => item.get('label')), ['web-1', 'worker-1']);
  assert.notOk(controller.get('instanceOptions').some((item) => /^1i/.test(item.get('label'))));

  destroyOwned(controller);
});

test('starts with all time and opens the picker with a useful 24 hour draft', function(assert) {
  let controller = controllerFor();

  assert.strictEqual(controller.get('timeRangeSummary'), 'servicePage.logTab.filter.allTime');
  assert.strictEqual(controller.get('activeFilterCount'), 0);
  controller.actions.openTimePicker.call(controller);

  assert.strictEqual(moment(controller.get('filters.createdTo')).diff(moment(controller.get('filters.createdFrom')), 'hours'), 24);
  assert.strictEqual(controller.get('activeTimePreset'), 'day');

  destroyOwned(controller);
});

test('supports the one-month and all-time quick ranges', function(assert) {
  let controller = controllerFor();

  controller.actions.setTimePreset.call(controller, 1, 'month');
  let from = moment(controller.get('filters.createdFrom'));
  let to = moment(controller.get('filters.createdTo'));

  assert.ok(from.clone().add(1, 'month').isSame(to), 'one month uses a calendar month instead of a fixed number of days');
  assert.strictEqual(controller.get('activeTimePreset'), 'month');

  controller.actions.setAllTimePreset.call(controller);
  assert.strictEqual(controller.get('filters.createdFrom'), null);
  assert.strictEqual(controller.get('filters.createdTo'), null);
  assert.strictEqual(controller.get('activeTimePreset'), 'all');
  assert.notOk(controller.get('timeRangeInvalid'), 'an unbounded range is a valid all-time query');

  destroyOwned(controller);
});

test('serializes time, level, container, scope, and text conditions in one query', function(assert) {
  let sent = [];
  let controller = controllerFor({send(name, options) { sent.push({name, options}); }});

  controller.setProperties({
    'filters.createdFrom': '2026-08-31T09:00:00',
    'filters.createdTo': '2026-08-31T10:00:00',
    'filters.level': 'error',
    'filters.instanceId': '1i22860',
    'filters.logScope': 'sub',
    'filters.eventType': 'service.instance.restart',
    'filters.eventTypeOperator': 'exact',
    'filters.description': 'container',
    'filters.descriptionOperator': 'contains',
  });
  controller.actions.search.call(controller);

  assert.strictEqual(controller.get('createdFrom'), moment('2026-08-31T09:00:00').toISOString());
  assert.strictEqual(controller.get('createdTo'), moment('2026-08-31T10:00:00').toISOString());
  assert.strictEqual(controller.get('level'), 'error');
  assert.strictEqual(controller.get('instanceId'), '1i22860');
  assert.strictEqual(controller.get('logScope'), 'sub');
  assert.strictEqual(controller.get('eventType'), 'service.instance.restart');
  assert.deepEqual(sent, [{name: 'filterLogs', options: {refreshIfUnchanged: false}}]);

  destroyOwned(controller);
});

test('blocks one-sided, inverted, and zero-width time ranges', function(assert) {
  let sent = [];
  let controller = controllerFor({send(name) { sent.push(name); }});

  [
    [null, '2026-08-31T10:00:00'],
    ['2026-08-31T11:00:00', '2026-08-31T10:00:00'],
    ['2026-08-31T10:00:00', '2026-08-31T10:00:00'],
  ].forEach(([from, to]) => {
    controller.set('filters.createdFrom', from);
    controller.set('filters.createdTo', to);
    controller.actions.search.call(controller);
  });

  assert.deepEqual(sent, []);
  assert.strictEqual(controller.get('filterError'), 'servicePage.logTab.filter.rangeError');

  destroyOwned(controller);
});

test('restart shortcut creates the exact restart event query and bounded range', function(assert) {
  let sent = [];
  let controller = controllerFor({send(name) { sent.push(name); }});

  controller.actions.applyShortcut.call(controller, 'restarts');

  assert.strictEqual(controller.get('filters.eventType'), 'service.instance.restart');
  assert.strictEqual(controller.get('filters.eventTypeOperator'), 'exact');
  assert.strictEqual(moment(controller.get('filters.createdTo')).diff(moment(controller.get('filters.createdFrom')), 'hours'), 24);
  assert.deepEqual(controller.get('optionalFilters').toArray(), ['eventType']);
  assert.deepEqual(sent, ['search']);

  sent.length = 0;
  controller.actions.search.call(controller);
  assert.strictEqual(controller.get('eventType'), 'service.instance.restart');
  assert.strictEqual(controller.get('eventTypeOperator'), 'exact');
  assert.deepEqual(sent, ['filterLogs']);

  destroyOwned(controller);
});

test('clear removes every condition and forces an unchanged all-time query to refresh', function(assert) {
  let sent = [];
  let controller = controllerFor({send(name, options) { sent.push({name, options}); }});

  controller.actions.clearAll.call(controller);

  assert.strictEqual(controller.get('createdFrom'), null);
  assert.strictEqual(controller.get('level'), null);
  assert.strictEqual(controller.get('instanceId'), null);
  assert.strictEqual(controller.get('logScope'), 'all');
  assert.deepEqual(controller.get('optionalFilters').toArray(), []);
  assert.deepEqual(sent, [{name: 'filterLogs', options: {refreshIfUnchanged: true}}]);

  destroyOwned(controller);
});
