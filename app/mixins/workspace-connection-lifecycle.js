import Mixin from '@ember/object/mixin';

export default Mixin.create({
  connectionInactive(entry = this.get('entry')) {
    if (this.get('userClosed') || this.isDestroyed || this.isDestroying || entry !== this.get('entry')) {
      return true;
    }
    if (!entry || entry.get('status') !== 'ended') {
      return false;
    }

    this.cancelReconnect();
    this.set('status', 'ended');
    if (this.setTerminalInputEnabled) {
      this.setTerminalInputEnabled(false);
    }
    let socket = this.get('socket');
    if (socket) {
      socket.onmessage = socket.onclose = null;
      this.set('socket', null);
      socket.close();
    }
    return true;
  },

  entryStatusChanged: function() {
    this.connectionInactive();
  }.observes('entry.status'),
});
