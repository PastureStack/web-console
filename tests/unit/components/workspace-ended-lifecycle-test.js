import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { settled } from '@ember/test-helpers';
import { module, test } from 'qunit';
import WorkspaceLogs from 'ui/components/workspace-logs/component';
import WorkspaceTerminal, { terminalCloseAction } from 'ui/components/workspace-terminal/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | workspace ended lifecycle');

function deferred() {
  let resolve, reject;
  let promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function subject(kind, options = {}) {
  let calls = {tickets: 0, brokers: [], sockets: 0, probes: 0, rotations: 0, updates: []};
  let entry = EmberObject.create({status: options.status || 'new', brokerReady: options.brokerReady || false});
  let workspace = EmberObject.create({
    updateSession(target, values) { calls.updates.push(values); target.setProperties(values); },
    brokerUrl() { return 'mock-broker'; },
    brokerProtocols() { return []; },
    brokerStatus() { calls.probes++; return options.probe || Promise.resolve({status: 'connected'}); },
    createBrokerSession(target) { calls.brokers.push(target); return options.broker || Promise.resolve({status: 'connected'}); },
    rotateBrokerIdentity() { calls.rotations++; },
  });
  let instance = EmberObject.create({
    hasAction() { return true; },
    doAction() { calls.tickets++; return options.access ? options.access() : Promise.resolve({}); },
  });
  let component;
  run(() => {
    component = createOwned(kind === 'logs' ? WorkspaceLogs : WorkspaceTerminal, {
      renderer: inertRenderer(), entry, workspace, instance,
      intl: EmberObject.create({t(key) { return key; }}),
      setupTerminal() {},
      openSocket() { calls.sockets++; },
    }, 'component');
  });
  return {component, entry, calls, end() { run(() => entry.set('status', 'ended')); },
    destroy() { destroyOwned(component); }};
}

for (let kind of ['logs', 'terminal']) {
  test(`${kind}: remount and reconnect never transport an ended entry`, async function(assert) {
    for (let brokerReady of [false, true]) {
      let s = subject(kind, {status: 'ended', brokerReady});
      let ansi = window.rc16AnsiUp;
      window.rc16AnsiUp = {AnsiUp: class {}};
      try {
        run(() => s.component.didInsertElement());
        await settled();
        run(() => {
          s.component.connect(false);
          s.component.connect(true);
          s.component.createBrokerSession();
          s.component.send('reconnect');
          if (kind === 'terminal') {
            s.component.probeBrokerSession();
            for (let action of ['create', 'rotate', 'connect', 'error']) {
              s.component.applyBrokerStatusAction(action);
            }
          }
        });
        let originalSocket = window.WebSocket, socketConstructions = 0;
        window.WebSocket = class { constructor() { socketConstructions++; } close() {} };
        try {
          let Factory = kind === 'logs' ? WorkspaceLogs : WorkspaceTerminal;
          run(() => Factory.prototype.openSocket.call(s.component, 'mock-broker', false));
        } finally { window.WebSocket = originalSocket; }
        assert.equal(socketConstructions, 0, 'the real openSocket method also rejects the ended entry');
        assert.equal(s.calls.tickets + s.calls.brokers.length + s.calls.sockets + s.calls.probes + s.calls.rotations, 0);
        assert.equal(s.component.get('status'), 'ended');
        assert.equal(s.entry.get('status'), 'ended');
        assert.deepEqual(s.calls.updates, [], 'the persisted ended entry is never rewritten');
      } finally { window.rc16AnsiUp = ansi; s.destroy(); }
    }
  });

  test(`${kind}: late ticket success or failure cannot create a broker after end`, async function(assert) {
    for (let rejected of [false, true]) {
      let access = deferred(), s = subject(kind, {access: () => access.promise});
      try {
        let request = run(() => s.component.createBrokerSession());
        assert.equal(s.calls.tickets, 1);
        s.end();
        if (rejected) { access.reject(new Error('late ticket')); } else { access.resolve({}); }
        await request;
        assert.equal(s.calls.brokers.length + s.calls.sockets, 0);
        assert.equal(s.entry.get('status'), 'ended');
        assert.equal(s.component.get('status'), 'ended');
        assert.equal(s.calls.updates.length, 1, 'only the original initializing update occurred');
      } finally { s.destroy(); }
    }
  });

  test(`${kind}: late broker success or failure cannot reopen an ended entry`, async function(assert) {
    for (let rejected of [false, true]) {
      let broker = deferred(), s = subject(kind, {broker: broker.promise});
      try {
        let request = run(() => s.component.createBrokerSession());
        await Promise.resolve();
        assert.equal(s.calls.brokers.length, 1);
        s.end();
        if (rejected) { broker.reject(new Error('late broker')); } else { broker.resolve({status: 'connected'}); }
        await request;
        assert.equal(s.calls.sockets, 0);
        assert.equal(s.entry.get('status'), 'ended');
        assert.equal(s.component.get('status'), 'ended');
        assert.equal(s.calls.updates.length, 1, 'no connecting or error update after end');
      } finally { s.destroy(); }
    }
  });

  test(`${kind}: an ended broker create response never opens a socket`, async function(assert) {
    let s = subject(kind, {broker: Promise.resolve({status: 'ended'})});
    try {
      await run(() => s.component.createBrokerSession());
      assert.equal(s.calls.tickets, 1);
      assert.equal(s.calls.brokers.length, 1);
      assert.equal(s.calls.sockets, 0);
      assert.equal(s.entry.get('status'), 'ended');
      assert.equal(s.component.get('status'), 'ended');
    } finally { s.destroy(); }
  });

  test(`${kind}: end cancels reconnect and ignores already queued socket frames`, async function(assert) {
    let s = subject(kind, {status: 'connected', brokerReady: true});
    let closes = 0;
    try {
      run(() => {
        if (kind === 'terminal') {
          s.component.set('term', {options: {disableStdin: false}});
        }
        s.component.set('socket', {onmessage() {}, onclose() {}, close() { closes++; }});
        s.component.scheduleReconnect();
      });
      assert.ok(s.component._reconnectTimer);
      s.end();
      assert.strictEqual(s.component._reconnectTimer, null);
      assert.strictEqual(s.component.get('socket'), null);
      assert.equal(closes, 1);
      if (kind === 'terminal') {
        assert.ok(s.component.get('term.options.disableStdin'), 'ending disables real terminal input');
      }
      run(() => {
        s.component.scheduleReconnect();
        for (let type of ['hello', 'output', 'status', 'error']) {
          s.component.handleMessage(JSON.stringify({type, status: 'connected', data: ''}));
        }
      });
      await settled();
      assert.strictEqual(s.component._reconnectTimer, null);
      assert.equal(s.component.get('reconnectAttempts'), 1, 'ending does not schedule another attempt');
      assert.equal(s.component.get('status'), 'ended');
      assert.equal(s.entry.get('status'), 'ended');
      assert.equal(s.calls.sockets + s.calls.probes + s.calls.tickets, 0);
      assert.deepEqual(s.calls.updates, []);
    } finally { s.destroy(); }
  });

  test(`${kind}: live reconnect and an explicitly new entry still work`, async function(assert) {
    let s = subject(kind, {status: 'connected', brokerReady: true});
    try {
      await run(() => s.component.connect(false));
      await settled();
      assert.equal(s.calls.sockets, 1, 'existing live session reconnects');
      s.end();
      let fresh = EmberObject.create({status: 'new', brokerReady: false});
      run(() => s.component.set('entry', fresh));
      await run(() => s.component.createBrokerSession());
      assert.equal(s.calls.tickets, 1);
      assert.deepEqual(s.calls.brokers, [fresh], 'new session has its own entry identity');
      assert.equal(s.calls.sockets, 2);
      assert.equal(s.entry.get('status'), 'ended', 'the old session stays ended');
      assert.equal(fresh.get('status'), 'connecting');
      assert.notOk(s.component.get('userClosed'), 'end is not a permanent component shutdown');
    } finally { s.destroy(); }
  });

  test(`${kind}: an old pending ticket cannot act on an explicitly new entry`, async function(assert) {
    let access = deferred(), count = 0;
    let s = subject(kind, {access: () => ++count === 1 ? access.promise : Promise.resolve({})});
    try {
      let oldRequest = run(() => s.component.createBrokerSession());
      s.end();
      let fresh = EmberObject.create({status: 'new', brokerReady: false});
      run(() => s.component.set('entry', fresh));
      await run(() => s.component.createBrokerSession());
      access.resolve({});
      await oldRequest;
      assert.deepEqual(s.calls.brokers, [fresh]);
      assert.equal(s.calls.sockets, 1);
      assert.equal(s.entry.get('status'), 'ended');
      assert.equal(fresh.get('status'), 'connecting');
    } finally { s.destroy(); }
  });

  test(`${kind}: queued socket and timer belong to their original entry`, async function(assert) {
    let s = subject(kind, {status: 'connected', brokerReady: true});
    let originalSocket = window.WebSocket, socket;
    window.WebSocket = class { constructor() { socket = this; } close() {} };
    try {
      let Factory = kind === 'logs' ? WorkspaceLogs : WorkspaceTerminal;
      run(() => {
        Factory.prototype.openSocket.call(s.component, 'mock-broker', false);
        s.component.scheduleReconnect();
      });
      assert.ok(s.component._reconnectTimer, 'the original entry has a real scheduled timer');
      let fresh = EmberObject.create({status: 'connected', brokerReady: true});
      run(() => {
        s.component.setProperties({entry: fresh, status: 'connected', createAttempted: true});
        socket.onmessage({data: JSON.stringify({type: 'hello', status: 'connected'})});
        socket.onclose();
      });
      await settled();
      assert.equal(s.calls.sockets + s.calls.probes + s.calls.tickets + s.calls.rotations, 0);
      assert.deepEqual(s.calls.updates, [], 'old socket callbacks never rewrite the new entry');
      assert.equal(fresh.get('status'), 'connected');
      assert.equal(s.component.get('status'), 'connected');
      assert.ok(s.component.get('createAttempted'), 'the old timer never clears the new connection state');
      assert.equal(s.component.get('reconnectAttempts'), 1);
      assert.strictEqual(s.component._reconnectTimer, null);
    } finally { window.WebSocket = originalSocket; s.destroy(); }
  });
}

test('terminal: a pending probe cannot reconnect, rotate or create after end', async function(assert) {
  for (let http of [200, 404, 403, 409, 502]) {
    let probe = deferred(), s = subject('terminal', {status: 'connected', probe: probe.promise});
    try {
      let request = run(() => s.component.probeBrokerSession());
      s.end();
      if (http === 200) { probe.resolve({status: 'connected'}); } else { probe.reject({status: http}); }
      await request;
      assert.equal(s.calls.probes, 1);
      assert.equal(s.calls.tickets + s.calls.brokers.length + s.calls.sockets + s.calls.rotations, 0, `late ${http} is inert`);
      assert.equal(s.entry.get('status'), 'ended');
      assert.equal(s.component.get('status'), 'ended');
      assert.deepEqual(s.calls.updates, []);
    } finally { s.destroy(); }
  }
  assert.equal(terminalCloseAction({entryStatus: 'ended', hasHello: true, createAttempted: true, status: 'connected'}), 'ended');
});
