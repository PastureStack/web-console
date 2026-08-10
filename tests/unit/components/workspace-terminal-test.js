import { module, test } from 'qunit';
import {
  decodeTerminalData,
  terminalBrokerStatusAction,
  terminalCloseAction,
} from 'ui/components/workspace-terminal/component';

module('Unit | Component | workspace terminal');

test('decodes brokered UTF-8 terminal output', function(assert) {
  let text = 'PastureStack 終端機\n';
  let encoded = window.btoa(unescape(encodeURIComponent(text)));

  assert.equal(decodeTerminalData(encoded), text);
});

test('probes a stale broker session before it has completed the handshake', function(assert) {
  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: false,
    hasHello: false,
    createAttempted: false,
    entryStatus: 'connected',
    status: 'connecting',
  }), 'probe');

  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: false,
    hasHello: false,
    createAttempted: false,
    entryStatus: 'ended',
    status: 'connecting',
  }), 'ended');
});

test('recovers missing or conflicting broker sessions without retrying forever', function(assert) {
  assert.equal(terminalBrokerStatusAction(200, 'connected'), 'connect');
  assert.equal(terminalBrokerStatusAction(200, 'missing'), 'create');
  assert.equal(terminalBrokerStatusAction(200, 'ended'), 'ended');
  assert.equal(terminalBrokerStatusAction(404), 'create');
  assert.equal(terminalBrokerStatusAction(403), 'rotate');
  assert.equal(terminalBrokerStatusAction(409), 'rotate');
  assert.equal(terminalBrokerStatusAction(502), 'error');
  assert.equal(terminalBrokerStatusAction(undefined), 'error');
});

test('reconnects only after a live broker session disconnects', function(assert) {
  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: false,
    hasHello: true,
    createAttempted: true,
    entryStatus: 'connected',
    status: 'connected',
  }), 'reconnect');

  assert.equal(terminalCloseAction({
    userClosed: true,
    destroyed: false,
    hasHello: true,
    createAttempted: true,
    entryStatus: 'connected',
    status: 'connected',
  }), 'ignore');

  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: true,
    hasHello: true,
    createAttempted: true,
    entryStatus: 'connected',
    status: 'connected',
  }), 'ignore');
});
