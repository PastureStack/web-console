import { next, later, debounce, cancel } from '@ember/runloop';
import { equal } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import ThrottledResize from 'ui/mixins/throttled-resize';
import WorkspaceConnectionLifecycle from 'ui/mixins/workspace-connection-lifecycle';
import { DEFAULT_COMMAND } from 'ui/components/container-shell/component';

const Terminal = window.Terminal;
const FitAddon = window.FitAddon.FitAddon;
const MAX_RECONNECT_ATTEMPTS = 4;

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
  if (options.entryStatus === 'ended') {
    return 'ended';
  }

  if (!options.hasHello && !options.createAttempted) {
    return 'probe';
  }

  return options.status === 'ended' ? 'none' : 'reconnect';
}

function terminalBrokerStatusAction(httpStatus, brokerStatus) {
  if (httpStatus === 404) {
    return 'create';
  }
  if (httpStatus === 403 || httpStatus === 409) {
    return 'rotate';
  }
  if (typeof httpStatus !== 'number' || httpStatus < 200 || httpStatus >= 300) {
    return 'error';
  }
  if (brokerStatus === 'missing') {
    return 'create';
  }
  if (brokerStatus === 'ended' || brokerStatus === 'error') {
    return 'ended';
  }
  return 'connect';
}

export default Component.extend(ThrottledResize, WorkspaceConnectionLifecycle, {
  classNames: ['workspace-terminal'],
  workspace: service('console-workspace'),
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

  isEnded: equal('status', 'ended'),

  didInsertElement() {
    this._super(...arguments);
    this.setupTerminal();
    next(this, () => {
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
        reconnectAttempts: 0,
        status: 'connecting',
      });
      this.connect(false);
    },

    contextMenuHandler() {
      this.set('contenteditable', true);
      later(this, () => {
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
    next(this, 'fit');
  },

  connect(create) {
    if (this.connectionInactive()) {
      return;
    }

    if (create) {
      this.createBrokerSession();
      return;
    }

    this.probeBrokerSession();
  },

  probeBrokerSession() {
    if (this.connectionInactive()) {
      return;
    }
    let workspace = this.get('workspace');
    let entry = this.get('entry');

    this.set('status', 'connecting');
    return workspace.brokerStatus(entry).then((response) => {
      if (this.connectionInactive(entry)) {
        return;
      }
      this.applyBrokerStatusAction(terminalBrokerStatusAction(200, response && response.status));
    }).catch((error) => {
      if (this.connectionInactive(entry)) {
        return;
      }
      this.applyBrokerStatusAction(terminalBrokerStatusAction(error && error.status, null));
    });
  },

  applyBrokerStatusAction(action) {
    if (this.connectionInactive()) {
      return;
    }
    let workspace = this.get('workspace');
    let entry = this.get('entry');

    if (action === 'create') {
      workspace.updateSession(entry, {brokerReady: false, status: 'initializing'});
      this.set('createAttempted', false);
      this.createBrokerSession();
    } else if (action === 'rotate') {
      workspace.rotateBrokerIdentity(entry);
      this.set('createAttempted', false);
      this.createBrokerSession();
    } else if (action === 'ended') {
      this.setTerminalInputEnabled(false);
      this.set('status', 'ended');
      workspace.updateSession(entry, {brokerReady: false, status: 'ended'});
    } else if (action === 'connect') {
      this.openSocket(workspace.brokerUrl(entry), false);
    } else {
      this.setTerminalInputEnabled(false);
      this.set('status', 'error');
      workspace.updateSession(entry, {status: 'error'});
    }
  },

  createBrokerSession() {
    if (this.connectionInactive()) {
      return;
    }
    let entry = this.get('entry');
    let workspace = this.get('workspace');
    let instance = this.get('instance');
    if (!instance || !instance.hasAction('execute')) {
      this.set('status', 'error');
      return;
    }

    this.set('createAttempted', true);
    this.set('status', 'initializing');
    workspace.updateSession(entry, {status: 'initializing'});
    let options = {
      attachStdin: true,
      attachStdout: true,
      tty: true,
      command: entry.get('command') || DEFAULT_COMMAND,
    };

    return instance.doAction('execute', options).then((access) => {
      if (this.connectionInactive(entry)) {
        return;
      }
      return workspace.createBrokerSession(entry, access);
    }).then((response) => {
      if (this.connectionInactive(entry)) {
        return;
      }
      if (terminalBrokerStatusAction(200, response && response.status) === 'ended') {
        this.applyBrokerStatusAction('ended');
        return;
      }
      workspace.updateSession(entry, {
        brokerReady: true,
        status: 'connecting',
      });
      this.openSocket(workspace.brokerUrl(entry), true);
    }).catch(() => {
      if (!this.connectionInactive(entry)) {
        this.set('status', 'error');
        workspace.updateSession(entry, {status: 'error'});
      }
    });
  },

  openSocket(url, creating) {
    if (this.connectionInactive()) {
      return;
    }
    let entry = this.get('entry');
    let previous = this.get('socket');
    if (previous) {
      previous.onclose = null;
      previous.close();
    }

    this.setProperties({
      status: creating ? 'initializing' : 'connecting',
      hasHello: false,
    });

    let protocols = this.get('workspace').brokerProtocols(entry);
    let socket = new WebSocket(url, protocols);
    this.set('socket', socket);

    socket.onmessage = (message) => {
      if (this.get('socket') === socket && !this.connectionInactive(entry)) {
        this.handleMessage(message.data);
      }
    };
    socket.onclose = () => {
      if (this.get('socket') !== socket || this.connectionInactive(entry)) {
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
      } else if (action === 'probe' || action === 'reconnect') {
        this.setTerminalInputEnabled(false);
        this.set('status', 'disconnected');
        this.get('workspace').updateSession(this.get('entry'), {status: 'disconnected'});
        this.scheduleReconnect();
      }
    };
  },

  handleMessage(raw) {
    if (this.connectionInactive()) {
      return;
    }
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
      next(this, 'fit');
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
    debounce(this, 'fit', 80);
  },

  scheduleReconnect() {
    this.cancelReconnect();
    if (this.connectionInactive()) {
      return;
    }
    let entry = this.get('entry');
    let attempt = this.incrementProperty('reconnectAttempts');
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      this.set('status', 'error');
      this.get('workspace').updateSession(this.get('entry'), {status: 'error'});
      return;
    }
    let delay = Math.min(10000, 500 * Math.pow(2, Math.min(attempt, 5)));
    let timer = later(this, () => {
      if (this._reconnectTimer !== timer) {
        return;
      }
      this._reconnectTimer = null;
      if (this.connectionInactive(entry)) {
        return;
      }
      this.set('createAttempted', false);
      this.connect(false);
    }, delay);
    this._reconnectTimer = timer;
  },

  cancelReconnect() {
    if (this._reconnectTimer) {
      cancel(this._reconnectTimer);
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

export {
  decodeTerminalData,
  terminalBrokerStatusAction,
  terminalCloseAction,
};
