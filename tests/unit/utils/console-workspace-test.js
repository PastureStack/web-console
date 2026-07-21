import { module, test } from 'qunit';
import {
  brokerWebSocketProtocols,
  brokerWebSocketUrl,
  clampWorkspaceGeometry,
  defaultWorkspaceGeometry,
  globalStorageKey,
  isWorkspaceSessionRecord,
  tabStorageKey,
  terminalLogicalKey,
  workspaceClientId,
  workspaceSecret,
  workspaceSessionId,
} from 'ui/utils/console-workspace';

module('Unit | Utility | console workspace');

test('creates valid non-identifying session credentials', function(assert) {
  assert.ok(/^psw_[A-Za-z0-9_-]{20,96}$/.test(workspaceSessionId()));
  assert.ok(workspaceSecret().length >= 40);
});

test('creates a distinct client id for each loaded browser tab', function(assert) {
  let first = workspaceClientId();
  let second = workspaceClientId();

  assert.notEqual(first, second);
  assert.ok(/^tab_[A-Za-z0-9_-]{20,96}$/.test(first));
  assert.ok(/^tab_[A-Za-z0-9_-]{20,96}$/.test(second));
});

test('separates global sessions from per-tab window layouts', function(assert) {
  assert.equal(
    globalStorageKey('account-1'),
    'pasturestack.consoleWorkspace.sessions.v1.account-1'
  );
  assert.equal(
    tabStorageKey('account-1'),
    'pasturestack.consoleWorkspace.layout.v2.account-1'
  );
});

test('keeps session secrets out of WebSocket URLs', function(assert) {
  let sessionId = 'psw_abcdefghijklmnopqrstuvwx';
  let secret = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH';
  let clientId = 'tab_abcdefghijklmnopqrstuvwx';
  let url = brokerWebSocketUrl(sessionId, {
    protocol: 'http:',
    host: 'console.example.test:8080',
  });
  let protocols = brokerWebSocketProtocols(secret, clientId);

  assert.equal(url, `ws://console.example.test:8080/v1/exec/sessions/${sessionId}`);
  assert.notOk(url.includes(secret));
  assert.deepEqual(protocols, [
    'pasturestack-console-v1',
    `pasturestack-secret.${secret}`,
    `pasturestack-client.${clientId}`,
  ]);
});

test('creates and clamps usable window geometry', function(assert) {
  let initial = defaultWorkspaceGeometry(2, 1440, 900);
  let clamped = clampWorkspaceGeometry({
    x: 5000,
    y: -100,
    width: 5000,
    height: 5000,
  }, 1440, 900);

  assert.equal(initial.state, 'open');
  assert.ok(initial.width <= 900);
  assert.ok(initial.height <= 620);
  assert.equal(clamped.x, 1360);
  assert.equal(clamped.y, 46);
  assert.equal(clamped.width, 1428);
  assert.equal(clamped.height, 838);
});

test('logical keys distinguish terminal commands and session kinds', function(assert) {
  let shell = terminalLogicalKey('terminal', '1a5', '1i1', ['/bin/sh']);
  let bash = terminalLogicalKey('terminal', '1a5', '1i1', ['/bin/bash']);
  let logs = terminalLogicalKey('logs', '1a5', '1i1', null);

  assert.notEqual(shell, bash);
  assert.notEqual(shell, logs);
  assert.equal(
    shell,
    terminalLogicalKey('terminal', '1a5', '1i1', ['/bin/sh'])
  );
});

test('accepts only complete persisted session records', function(assert) {
  let valid = {
    sessionId: 'psw_abcdefghijklmnopqrstuvwx',
    secret: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH',
    kind: 'terminal',
    status: 'connected',
    projectId: '1a5',
    instanceId: '1i1',
    logicalKey: 'terminal:1a5:1i1:[]',
  };

  assert.ok(isWorkspaceSessionRecord(valid));
  assert.notOk(isWorkspaceSessionRecord(Object.assign({}, valid, {secret: 'short'})));
  assert.notOk(isWorkspaceSessionRecord(Object.assign({}, valid, {kind: 'unknown'})));
  assert.notOk(isWorkspaceSessionRecord(Object.assign({}, valid, {status: 'unknown'})));
  assert.notOk(isWorkspaceSessionRecord(Object.assign({}, valid, {command: 'rm -rf'})));
});
