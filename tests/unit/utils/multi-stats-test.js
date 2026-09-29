import { module, test } from 'qunit';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';

import MultiStatsSocket from 'ui/utils/multi-stats';
import Socket from 'ui/utils/socket';

module('Unit | Utility | multi stats');

test('a disconnected container host does not request a stats token', function(assert) {
  let requests = 0;
  const resource = EmberObject.create({
    state: 'running',
    healthState: null,
    hostId: '1h18',
    primaryHost: EmberObject.create({state: 'disconnected', agentState: 'disconnected'}),
    hasLink() { requests++; return true; },
  });
  const stats = run(() => MultiStatsSocket.create({resource}));

  assert.false(stats.get('available'), 'a running container on an offline host has no live stats');
  assert.equal(requests, 0, 'no request is sent to the offline host');
  run(() => stats.close());
});

test('a rejected stats link settles without an unhandled rejection or retry storm', async function(assert) {
  let requests = 0;
  const resource = EmberObject.create({
    state: 'running',
    healthState: null,
    hasLink() { return true; },
    followLink() {
      requests++;
      return Promise.reject({status: 503});
    },
  });
  const stats = run(() => MultiStatsSocket.create({resource}));
  await stats.get('connectPending');

  assert.equal(requests, 1, 'one request was attempted');
  assert.true(stats.get('connectError'), 'the UI can show an unavailable state');
  assert.false(stats.get('loading'), 'the spinner does not remain indefinitely');
  assert.notStrictEqual(stats.get('retryTimer'), null, 'at most one delayed retry is scheduled');
  const firstRetry = stats.get('retryTimer');
  run(() => stats.statsUnavailable());
  assert.strictEqual(stats.get('retryTimer'), firstRetry, 'a repeated failure does not schedule another retry');

  run(() => stats.close());
  assert.notOk(stats.get('retryTimer'), 'closing cancels the retry');
});

test('a synchronous stats-link failure is converted to an unavailable state', async function(assert) {
  const resource = EmberObject.create({
    state: 'running',
    hasLink() { return true; },
    followLink() { throw new Error('offline'); },
  });
  const stats = run(() => MultiStatsSocket.create({resource}));
  await stats.get('connectPending');

  assert.true(stats.get('connectError'), 'a synchronous transport error is handled');
  assert.false(stats.get('loading'), 'the spinner stops');
  run(() => stats.close());
});

test('a socket connect failure releases the old socket before retry', async function(assert) {
  const originalCreate = Socket.create;
  let attempts = 0;
  let disconnects = 0;
  Socket.create = function() {
    return {
      on() {},
      connect() { attempts++; throw new Error('socket unavailable'); },
      disconnect() { disconnects++; },
    };
  };
  let stats;
  try {
    const resource = EmberObject.create({
      state: 'running',
      hasLink() { return true; },
      followLink() { return Promise.resolve(EmberObject.create({url: 'ws://qa.invalid/stats', token: 'test'})); },
    });
    stats = run(() => MultiStatsSocket.create({resource}));
    await stats.get('connectPending');
    assert.strictEqual(stats.get('socket'), null, 'failed socket cannot block the next attempt');
    assert.strictEqual(disconnects, 1, 'partially started socket is cleaned up');
    assert.notOk(stats.get('loading'), 'the chart shows unavailable instead of spinning');

    await run(() => stats.connect());
    assert.strictEqual(attempts, 2, 'a later retry can build a fresh socket');
    assert.strictEqual(disconnects, 2, 'second failed socket is also released');
    assert.strictEqual(stats.get('socket'), null);
  } finally {
    if (stats) run(() => stats.close());
    Socket.create = originalCreate;
  }
});

test('missing stats link stops the spinner without a retry loop', function(assert) {
  let requests = 0;
  const resource = EmberObject.create({
    state: 'running',
    hasLink() { return false; },
    followLink() { requests++; },
  });
  const stats = run(() => MultiStatsSocket.create({resource}));

  assert.true(stats.get('connectError'), 'missing link has an unavailable state');
  assert.strictEqual(stats.get('connectErrorStatus'), 404, 'missing link is identified');
  assert.false(stats.get('loading'), 'missing link cannot leave the spinner running');
  assert.notOk(stats.get('retryTimer'), 'an absent capability is not polled');
  assert.strictEqual(requests, 0, 'no URL request is attempted');
  run(() => stats.close());
});

test('401, 403, and 404 stats failures keep their status without retrying', async function(assert) {
  for (const status of [401, 403, 404]) {
    let requests = 0;
    const resource = EmberObject.create({
      state: 'running',
      hasLink() { return true; },
      followLink() { requests++; return Promise.reject({status}); },
    });
    const stats = run(() => MultiStatsSocket.create({resource}));
    await stats.get('connectPending');

    assert.strictEqual(requests, 1, `${status} attempts once`);
    assert.strictEqual(stats.get('connectErrorStatus'), status, `${status} stays diagnostic`);
    assert.false(stats.get('loading'), `${status} hides the spinner`);
    assert.notOk(stats.get('retryTimer'), `${status} is not retried`);
    run(() => stats.close());
  }
});

test('a late rejected stats link cannot restart a closed chart', async function(assert) {
  let rejectLink;
  const link = new Promise((resolve, reject) => { rejectLink = reject; });
  const resource = EmberObject.create({
    state: 'running',
    hasLink() { return true; },
    followLink() { return link; },
  });
  const stats = run(() => MultiStatsSocket.create({resource}));
  const pending = stats.get('connectPending');
  run(() => stats.close());
  rejectLink({status: 503});
  await pending;

  assert.false(stats.get('connectError'), 'the stale response does not replace the closed state');
  assert.notOk(stats.get('retryTimer'), 'no retry is scheduled after close');
});
