import { run } from '@ember/runloop';
import { A } from '@ember/array';
import { module, test } from 'qunit';

import Socket from 'ui/utils/socket';

module('Unit | Utility | socket');

test('a disconnected listener can replace a socket without a competing reconnect timer', function(assert) {
  let replacement = {
    __sockId: 2,
  };
  let closed = {
    __sockId: 1,
  };
  let socket = Socket.create({
    autoReconnect: true,
    _disconnectCbs: A(),
    _socket: closed,
    _state: 'connected',
  });

  socket.on('disconnected', () => {
    socket.setProperties({
      _socket: replacement,
      _state: 'connecting',
    });
  });

  socket._closed({target: closed});

  assert.equal(socket.get('_socket'), replacement, 'the replacement remains active');
  assert.equal(socket.get('_state'), 'connecting', 'the replacement state is preserved');
  assert.notOk(socket.get('_reconnectTimer'), 'no second reconnect is scheduled');

  run(() => socket.destroy());
});

test('a delayed close event cannot clear a newer socket', function(assert) {
  let replacement = {
    __sockId: 2,
  };
  let socket = Socket.create({
    _disconnectCbs: A(),
    _socket: replacement,
    _state: 'connected',
  });

  socket._closed({target: {__sockId: 1}});

  assert.equal(socket.get('_socket'), replacement, 'the newer socket remains active');
  assert.equal(socket.get('_state'), 'connected', 'the newer socket state is unchanged');

  run(() => socket.destroy());
});
