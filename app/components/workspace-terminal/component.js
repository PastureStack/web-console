import Ember from 'ember';
import ThrottledResize from 'ui/mixins/throttled-resize';
import { DEFAULT_COMMAND } from 'ui/components/container-shell/component';

const Terminal = window.Terminal;
const FitAddon = window.FitAddon.FitAddon;

function decodeTerminalData(data) {
  try {
    return decodeURIComponent(escape(window.atob(data)));
  } catch (e) {
    return window.atob(data);
  }
}

function terminalCloseAction(options) {
  if (options.userClosed || options.destroyed) {
    return 'ignore';
  }

  if (!options.hasHello && !options.createAttempted) {
    return options.entryStatus === 'ended' ? 'ended' : 'create';
  }

  return options.status === 'ended' ? 'none' : 'reconnect';
}

export default Ember.Component.extend(ThrottledResize, {
  classNames: ['workspace-terminal'],
  workspace: Ember.inject.service('console-workspace'),
  entry: null,
  instance: null,
  status: 'connecting',
  controllerId: null,
  socket: null,
  term: null,
  fitAddon: null,
  termDataDisposable: null,
  lastSequence: 0,
  hasHello: false,
  createAttempted: false,
  reconnectAttempts: 0,
  userClosed: false,
  contenteditable: false,

  isController: function() {
    return this.get('controllerId') === this.get('workspace.clientId');
  }.property('controllerId', 'workspace.clientId'),

  isEnded: Ember.computed.equal('status', 'ended'),

  didInsertElement() {
    this._super(...arguments);
    this.setupTerminal();
    Ember.run.next(this, () => {
      let shouldCreate = !this.get('entry.brokerReady') && this.get('entry.status') !== 'ended';
      this.connect(shouldCreate);
    });
  },

  willDestroyElement() {
    this.disconnect();
    this.disposeTerminal();
    this._super(...arguments);
  },

  actions: {
    takeControl() {
      this.sendFrame({type: 'claim'});
    },

    reconnect() {
      this.cancelReconnect();
      this.setProperties({
        hasHello: false,
        createAttempted: false,
        status: 'connecting',
      });
      this.connect(false);
    },

    contextMenuHandler() {
      this.set('contenteditable', true);
      Ember.run.later(this, () => {
        if (!this.isDestroyed && !this.isDestroying) {
          this.set('contenteditable', false);
        }
      }, 20);
    },
  },

  setupTerminal() {
    let term = new Terminal({
      cursorBlink: true,
      scrollback: 10000,
      convertEol: false,
      disableStdin: true,
    });
    let fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(this.$('.workspace-terminal-body')[0]);
    this.setProperties({
      term,
      fitAddon,
      termDataDisposable: term.onData((data) => {
        if (!this.get('isController')) {
          this.sendFrame({type: 'claim'});
        }
        this.sendFrame({
          type: 'input',
          data: window.btoa(unescape(encodeURIComponent(data))),
        });
      }),
    });
    Ember.run.next(this, 'fit');
  },

  connect(create) {
    if (this.get('userClosed') || this.isDestroyed || this.isDestroying) {
      return;
    }

    if (create) {
      if (this.get('entry.status') === 'ended') {
        this.set('status', 'ended');
        return;
      }
      this.createBrokerSession();
      return;
    }

    this.openSocket(this.get('workspace').brokerUrl(this.get('entry')), false);
  },

  createBrokerSession() {
    let instance = this.get('instance');
    if (!instance || !instance.hasAction('execute')) {
      this.set('status', 'error');
      return;
    }

    this.set('createAttempted', true);
    this.set('status', 'initializing');
    this.get('workspace').updateSession(this.get('entry'), {status: 'initializing'});
    let options = {
      attachStdin: true,
      attachStdout: true,
      tty: true,
      command: this.get('entry.command') || DEFAULT_COMMAND,
    };

    instance.doAction('execute', options).then((access) => {
      if (this.get('userClosed') || this.isDestroyed || this.isDestroying) {
        return;
      }
      return this.get('workspace').createBrokerSession(this.get('entry'), access);
    }).then(() => {
      if (this.get('userClosed') || this.isDestroyed || this.isDestroying) {
        return;
      }
      this.get('workspace').updateSession(this.get('entry'), {
        brokerReady: true,
        status: 'connecting',
      });
      this.openSocket(this.get('workspace').brokerUrl(this.get('entry')), true);
    }).catch(() => {
      if (!this.isDestroyed && !this.isDestroying) {
        this.set('status', 'error');
        this.get('workspace').updateSession(this.get('entry'), {status: 'error'});
      }
    });
  },

  openSocket(url, creating) {
    let previous = this.get('socket');
    if (previous) {
      previous.onclose = null;
      previous.close();
    }

    this.setProperties({
      status: creating ? 'initializing' : 'connecting',
      hasHello: false,
    });

    let protocols = this.get('workspace').brokerProtocols(this.get('entry'));
    let socket = new WebSocket(url, protocols);
    this.set('socket', socket);

    socket.onmessage = (message) => this.handleMessage(message.data);
    socket.onclose = () => {
      if (this.get('socket') !== socket) {
        return;
      }

      this.set('socket', null);
      let action = terminalCloseAction({
        userClosed: this.get('userClosed'),
        destroyed: this.isDestroyed || this.isDestroying,
        hasHello: this.get('hasHello'),
        createAttempted: this.get('createAttempted'),
        entryStatus: this.get('entry.status'),
        status: this.get('status'),
      });

      if (action === 'ended') {
        this.set('status', 'ended');
      } else if (action === 'create') {
        this.connect(true);
      } else if (action === 'reconnect') {
        this.setTerminalInputEnabled(false);
        this.set('status', 'disconnected');
        this.get('workspace').updateSession(this.get('entry'), {status: 'disconnected'});
        this.scheduleReconnect();
      }
    };
  },

  handleMessage(raw) {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (frame.type) {
    case 'hello':
      this.setProperties({
        hasHello: true,
        createAttempted: true,
        reconnectAttempts: 0,
        status: frame.status || 'connected',
        controllerId: frame.controllerId || null,
      });
      this.get('workspace').updateSession(this.get('entry'), {
        status: frame.status || 'connected',
        brokerReady: true,
        lastActivity: frame.lastActivity,
      });
      this.setTerminalInputEnabled(frame.status === 'connected');
      Ember.run.next(this, 'fit');
      break;
    case 'replay':
      (frame.replay || []).forEach((entry) => {
        this.writeOutput(entry.sequence, entry.data);
      });
      break;
    case 'output':
      this.writeOutput(frame.sequence, frame.data);
      if (this.get('status') !== 'connected') {
        this.set('status', 'connected');
        this.get('workspace').updateSession(this.get('entry'), {status: 'connected'});
      }
      this.setTerminalInputEnabled(true);
      break;
    case 'control':
      this.set('controllerId', frame.controllerId || null);
      break;
    case 'control-denied':
      this.set('controllerId', frame.controllerId || null);
      break;
    case 'status':
      this.setProperties({
        status: frame.status,
        controllerId: frame.controllerId || null,
      });
      this.get('workspace').updateSession(this.get('entry'), {
        status: frame.status,
        lastActivity: frame.lastActivity,
      });
      this.setTerminalInputEnabled(frame.status === 'connected');
      break;
    case 'error':
      this.set('status', 'error');
      this.setTerminalInputEnabled(false);
      this.get('workspace').updateSession(this.get('entry'), {status: 'error'});
      break;
    }
  },

  writeOutput(sequence, data) {
    if (!data || (sequence && sequence <= this.get('lastSequence'))) {
      return;
    }
    if (sequence) {
      this.set('lastSequence', sequence);
    }
    let term = this.get('term');
    if (term) {
      term.write(decodeTerminalData(data));
    }
  },

  sendFrame(frame) {
    let socket = this.get('socket');
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
      return true;
    }
    return false;
  },

  setTerminalInputEnabled(enabled) {
    let term = this.get('term');
    if (term && term.options) {
      term.options.disableStdin = !enabled;
    }
  },

  fit() {
    let fitAddon = this.get('fitAddon');
    if (!fitAddon) {
      return;
    }
    let geometry = fitAddon.proposeDimensions();
    if (!geometry) {
      return;
    }
    fitAddon.fit();
    if (this.get('isController')) {
      this.sendFrame({
        type: 'resize',
        cols: geometry.cols,
        rows: geometry.rows,
      });
    }
  },

  onResize() {
    Ember.run.debounce(this, 'fit', 80);
  },

  scheduleReconnect() {
    this.cancelReconnect();
    let attempt = this.incrementProperty('reconnectAttempts');
    let delay = Math.min(10000, 500 * Math.pow(2, Math.min(attempt, 5)));
    this._reconnectTimer = Ember.run.later(this, () => {
      this.set('createAttempted', false);
      this.connect(false);
    }, delay);
  },

  cancelReconnect() {
    if (this._reconnectTimer) {
      Ember.run.cancel(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  disconnect() {
    this.set('userClosed', true);
    this.cancelReconnect();
    let socket = this.get('socket');
    if (socket) {
      socket.onclose = null;
      socket.close();
      this.set('socket', null);
    }
  },

  disposeTerminal() {
    let disposable = this.get('termDataDisposable');
    if (disposable && disposable.dispose) {
      disposable.dispose();
    }
    let fitAddon = this.get('fitAddon');
    if (fitAddon && fitAddon.dispose) {
      fitAddon.dispose();
    }
    let term = this.get('term');
    if (term) {
      term.dispose();
    }
    this.setProperties({
      termDataDisposable: null,
      fitAddon: null,
      term: null,
    });
  },
});

export { decodeTerminalData, terminalCloseAction };
