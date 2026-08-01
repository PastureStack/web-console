import { module, test } from 'qunit';
import {
  decodeTerminalData,
  terminalCloseAction,
} from 'ui/components/workspace-terminal/component';

module('Unit | Component | workspace terminal');

test('decodes brokered UTF-8 terminal output', function(assert) {
  let text = 'PastureStack 終端機\n';
  let encoded = window.btoa(unescape(encodeURIComponent(text)));

  assert.equal(decodeTerminalData(encoded), text);
});

test('replaces a stale broker session before it has completed the handshake', function(assert) {
  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: false,
    hasHello: false,
    createAttempted: false,
    entryStatus: 'connected',
    status: 'connecting',
  }), 'create');

  assert.equal(terminalCloseAction({
    userClosed: false,
    destroyed: false,
    hasHello: false,
    createAttempted: false,
    entryStatus: 'ended',
    status: 'connecting',
  }), 'ended');
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
