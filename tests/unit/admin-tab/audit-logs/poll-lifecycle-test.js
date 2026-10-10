import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { _backburner, cancel, run } from '@ember/runloop';
import { defer } from 'rsvp';
import { module, test } from 'qunit';
import AuditLogsRoute from 'ui/admin-tab/audit-logs/route';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

function rows(id) {
  return A([EmberObject.create({id})]);
}

function pollFixture() {
  let response = defer();
  let authGeneration = 'poll-initial-session';
  let calls = [], sends = [], refreshes = 0;
  let params = {accountId: 'visible-environment', timeScope: 'all', eventType: 'change', sortOrder: 'asc'};
  let originalRows = rows('original-visible-result');
  let model = EmberObject.create({auditLog: originalRows, queryError: null});
  let controller = EmberObject.create({model, isFiltering: false});
  let route = createOwned(AuditLogsRoute, {
    access: EmberObject.create({captureGeneration() { return authGeneration; }}),
    controller,
    paramsFor(name) {
      if (name !== 'admin-tab.audit-logs') { throw new Error('UnexpectedPollRoute'); }
      return params;
    },
    userStore: EmberObject.create({
      find(type, id, options) {
        calls.push({type, id, options});
        return response.promise;
      },
    }),
    send(...args) { sends.push(args); },
    refresh() { refreshes++; return 'retry-refreshed'; },
  }, 'route');
  return {route, response, model, controller, originalRows, calls, sends, params,
    adoptSession() { authGeneration = 'poll-adopted-session'; },
    refreshCount() { return refreshes; },
    destroy() { route.cancelLogUpdate(); destroyOwned(route); },
  };
}

function fireScheduledPoll(route, assert) {
  let originalPlatform = _backburner._platform;
  // Never cancel/advance an unrelated Ember timer. The override exists only
  // within this synchronous schedule/fire block, not across a deferred await.
  if (!Array.isArray(_backburner._timers) || _backburner._timers.length !== 0 ||
      _backburner._timerTimeoutId !== null) {
    throw new Error('PollClockRequiresAnIdleTimerQueue');
  }
  let now = originalPlatform.now();
  let timeout = null, timerId;
  let handle = {};
  _backburner._platform = {
    ...originalPlatform,
    now() { return now; },
    setTimeout(callback, wait) {
      if (timeout || callback !== _backburner._boundRunExpiredTimers || wait !== 15000) {
        throw new Error('PollClockUnexpectedTimer');
      }
      timeout = {callback, wait, cancelled: false};
      return handle;
    },
    clearTimeout(id) {
      if (id !== handle) { throw new Error('PollClockMustNotCancelAnotherTimer'); }
      timeout.cancelled = true;
    },
  };
  try {
    run(() => route.scheduleLogUpdate());
    timerId = route.get('timer');
    assert.ok(timerId !== null, 'scheduleLogUpdate installs the actual Ember later timer');
    assert.ok(timeout && !timeout.cancelled, 'the platform receives the real Backburner timeout');
    assert.strictEqual(_backburner._timers.length, 6, 'only the owned poll is scheduled');
    assert.strictEqual(_backburner._timers[1], timerId, 'the queued timer is the route timer');
    now += timeout.wait;
    // Execute the platform timeout, not the route closure or applyQueryFailure.
    // Backburner expires and flushes the actual later callback itself.
    timeout.callback();
    assert.strictEqual(_backburner._timers.length, 0, 'the timer callback has actually expired');
  } finally {
    // On an assertion/exception before firing, remove only our own timer while
    // its matching clock is still installed. Never use cancelTimers().
    try {
      let ownedId = timerId === undefined ? route.get('timer') : timerId;
      if (_backburner._timerTimeoutId === handle && ownedId !== null && ownedId !== undefined) {
        cancel(ownedId);
      }
    } finally {
      _backburner._platform = originalPlatform;
    }
  }
  assert.strictEqual(_backburner._platform, originalPlatform, 'the platform is restored before response settlement');
  return timerId;
}

async function settleResponse(fixture, success, value) {
  run(() => success ? fixture.response.resolve(value) : fixture.response.reject(value));
  // Drain this response's RSVP handlers, with no sleep or global timer flush.
  await fixture.response.promise.then(() => undefined, () => undefined);
}

function changeLifecycle(fixture, change) {
  if (change === 'query') {
    fixture.route.actions.filterLogs.call(fixture.route);
    fixture.controller.set('model', EmberObject.create({auditLog: rows('new-query-result'), queryError: null}));
    fixture.route.scheduleLogUpdate();
  } else if (change === 'session') {
    fixture.adoptSession();
  } else {
    fixture.route.deactivate();
  }
}

function screenState(fixture) {
  return {model: fixture.controller.get('model'), auditLog: fixture.controller.get('model.auditLog'),
    queryError: fixture.controller.get('model.queryError'), isFiltering: fixture.controller.get('isFiltering'),
    generation: fixture.route.get('pollGeneration'), timer: fixture.route.get('timer')};
}

function assertUnchanged(assert, fixture, state, label) {
  assert.strictEqual(fixture.controller.get('model'), state.model, `${label}: no model adoption`);
  assert.strictEqual(fixture.controller.get('model.auditLog'), state.auditLog, `${label}: visible rows unchanged`);
  assert.strictEqual(fixture.controller.get('model.queryError'), state.queryError, `${label}: no stale error`);
  assert.strictEqual(fixture.controller.get('isFiltering'), state.isFiltering, `${label}: loading state unchanged`);
  assert.strictEqual(fixture.route.get('pollGeneration'), state.generation, `${label}: no cancellation or restart`);
  assert.strictEqual(fixture.route.get('timer'), state.timer, `${label}: no new polling timer`);
  assert.deepEqual(fixture.sends, [], `${label}: no sessionInvalid dispatch`);
}

module('Unit | Route | admin tab | audit logs poll lifecycle');

test('a current timer callback sends the applied filters and success schedules the next poll', async function(assert) {
  let fixture = pollFixture();
  try {
    let firstTimer = fireScheduledPoll(fixture.route, assert);
    assert.deepEqual(fixture.calls, [{type: 'auditLog', id: null, options: {
      filter: {accountId: 'visible-environment', timeScope: 'all', eventType_like: '%change%'},
      limit: 100, depaginate: false, forceReload: true, url: 'pasturestack/audit-logs',
      sortBy: 'created', sortOrder: 'asc',
    }}], 'the actual timer uses the bounded permission-aware query contract');
    let nextRows = rows('current-poll-result');
    await settleResponse(fixture, true, nextRows);
    assert.strictEqual(fixture.controller.get('model.auditLog'), nextRows, 'the current response is adopted');
    assert.strictEqual(fixture.controller.get('model.queryError'), null);
    assert.ok(fixture.route.get('timer') !== null && fixture.route.get('timer') !== firstTimer,
      'success installs a distinct next timer through scheduleLogUpdate');
    assert.deepEqual(fixture.sends, []);
  } finally {
    fixture.destroy();
  }
});

test('deferred timer success cannot change the screen after a new query, session adoption or deactivate', async function(assert) {
  for (let change of ['query', 'session', 'deactivate']) {
    let fixture = pollFixture();
    try {
      fireScheduledPoll(fixture.route, assert);
      assert.strictEqual(fixture.calls.length, 1, `${change}: the timer really requested data`);
      changeLifecycle(fixture, change);
      let state = screenState(fixture);
      await settleResponse(fixture, true, rows('stale-private-result'));
      assertUnchanged(assert, fixture, state, change);
      assert.strictEqual(fixture.calls.length, 1, `${change}: no extra poll request`);
    } finally {
      fixture.destroy();
    }
  }
});

test('deferred timer 401 and 403 cannot alter a newer lifecycle or invalidate its session', async function(assert) {
  for (let change of ['query', 'session', 'deactivate']) {
    for (let status of [401, 403]) {
      let fixture = pollFixture();
      try {
        fireScheduledPoll(fixture.route, assert);
        assert.strictEqual(fixture.calls.length, 1, `${change}/${status}: the timer really requested data`);
        changeLifecycle(fixture, change);
        let state = screenState(fixture);
        await settleResponse(fixture, false, {status});
        assertUnchanged(assert, fixture, state, `${change}/${status}`);
        assert.strictEqual(fixture.calls.length, 1, `${change}/${status}: no retry request`);
      } finally {
        fixture.destroy();
      }
    }
  }
});

test('a current timer 403 stops polling and retains the safe error and explicit retry', async function(assert) {
  let fixture = pollFixture();
  try {
    fireScheduledPoll(fixture.route, assert);
    fixture.controller.set('isFiltering', true);
    await settleResponse(fixture, false, {status: 403, body: {message: 'Must never be displayed'}});
    assert.strictEqual(fixture.controller.get('model.auditLog'), null, 'denied rows are not presented as success');
    assert.deepEqual(fixture.controller.get('model.queryError'), {
      messageKey: 'auditLogsPage.queryErrors.forbidden', canNarrow: false, status: 403, code: null,
    }, 'only a safe retryable presentation state is retained');
    assert.notOk(fixture.controller.get('isFiltering'));
    assert.strictEqual(fixture.route.get('timer'), null, 'current failure cancels the polling loop');
    fixture.route.scheduleLogUpdate();
    assert.strictEqual(fixture.route.get('timer'), null, 'an error state cannot start automatic retries');
    assert.strictEqual(fixture.calls.length, 1, 'no automatic second request');
    assert.deepEqual(fixture.sends, [], 'permission denial is not authentication failure');
    assert.strictEqual(fixture.route.actions.retryAuditQuery.call(fixture.route), 'retry-refreshed');
    assert.strictEqual(fixture.refreshCount(), 1, 'the normal explicit retry action remains available');
    assert.deepEqual(fixture.params, {accountId: 'visible-environment', timeScope: 'all', eventType: 'change', sortOrder: 'asc'},
      'retry does not clear the applied filters');
  } finally {
    fixture.destroy();
  }
});
