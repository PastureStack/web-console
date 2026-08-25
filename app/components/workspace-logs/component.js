import $ from 'jquery';
import { next, later, cancel } from '@ember/runloop';
import { equal } from '@ember/object/computed';
import { service } from '@ember/service';
import Component from '@ember/component';
import Util from 'ui/utils/util';
import { formatDateTime } from 'ui/utils/date-time';

const LOG_WRAP_STORAGE_KEY = 'pasturestack.consoleWorkspace.logs.wrap.v1';

function createAnsiUp() {
  let AnsiUpModule = window.rc16AnsiUp || {};
  let AnsiUp = AnsiUpModule.AnsiUp || window.AnsiUp;
  let ansiUp = new AnsiUp();
  if ('escape_html' in ansiUp) {
    ansiUp.escape_html = false;
  }
  return ansiUp;
}

const typeClass = {
  0: 'log-combined',
  1: 'log-stdout',
  2: 'log-stderr',
};

function parseLogPayload(payload) {
  let type = parseInt((payload || '').substr(1, 1), 10);
  if (!(type in typeClass)) {
    type = 0;
  }

  return {
    type,
    lines: (payload || '').substr(2).trim().split(/\n/).filter((line) => line),
  };
}

function readLogWrapPreference(storage = window.localStorage) {
  try {
    return storage.getItem(LOG_WRAP_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

function saveLogWrapPreference(value, storage = window.localStorage) {
  try {
    storage.setItem(LOG_WRAP_STORAGE_KEY, value ? 'true' : 'false');
    return true;
  } catch (e) {
    return false;
  }
}

export default Component.extend({
  classNames: ['workspace-logs'],
  workspace: service('console-workspace'),
  intl: service(),
  entry: null,
  instance: null,
  status: 'connecting',
  socket: null,
  lastSequence: 0,
  hasHello: false,
  createAttempted: false,
  reconnectAttempts: 0,
  userClosed: false,
  which: 'combined',
  isCombined: equal('which', 'combined'),
  isStdOut: equal('which', 'stdout'),
  isStdErr: equal('which', 'stderr'),
  stdErrVisible: true,
  stdOutVisible: true,
  wrapLines: false,

  didInsertElement() {
    this._super(...arguments);
    this._ansiUp = createAnsiUp();
    this._wrapPreferenceLoaded = true;
    this.set('wrapLines', readLogWrapPreference());
    next(this, () => {
      let shouldCreate = !this.get('entry.brokerReady') && this.get('entry.status') !== 'ended';
      this.connect(shouldCreate);
    });
  },

  willDestroyElement() {
    this.disconnect();
    this._super(...arguments);
  },

  wrapLinesChanged: function() {
    if (!this._wrapPreferenceLoaded) {
      return;
    }
    saveLogWrapPreference(this.get('wrapLines'));
    next(this, () => {
      let body = this.$('.workspace-log-body')[0];
      if (body && this.get('wrapLines')) {
        body.scrollLeft = 0;
      }
    });
  }.observes('wrapLines'),

  actions: {
    clear() {
      let body = this.$('.workspace-log-body')[0];
      body.innerHTML = '';
      body.scrollTop = 0;
    },

    scrollToTop() {
      this.$('.workspace-log-body').stop().animate({scrollTop: '0px'});
    },

    scrollToBottom() {
      let body = this.$('.workspace-log-body');
      body.stop().animate({scrollTop: `${body[0].scrollHeight + 1000}px`});
    },

    changeShow(which) {
      this.setProperties({
        which,
        stdErrVisible: which === 'combined' || which === 'stderr',
        stdOutVisible: which === 'combined' || which === 'stdout',
      });
      next(this, () => this.send('scrollToBottom'));
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
    if (!instance || !instance.hasAction('logs')) {
      this.set('status', 'error');
      return;
    }

    this.set('createAttempted', true);
    this.set('status', 'initializing');
    this.get('workspace').updateSession(this.get('entry'), {status: 'initializing'});
    instance.doAction('logs', {
      follow: true,
      lines: 500,
    }).then((access) => {
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
      if (this.get('userClosed') || this.isDestroyed || this.isDestroying) {
        return;
      }
      this.set('socket', null);
      if (!this.get('hasHello') && !this.get('createAttempted')) {
        if (this.get('entry.status') === 'ended') {
          this.set('status', 'ended');
        } else {
          this.connect(true);
        }
      } else if (this.get('status') !== 'ended') {
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
      });
      this.get('workspace').updateSession(this.get('entry'), {
        status: frame.status || 'connected',
        brokerReady: true,
        lastActivity: frame.lastActivity,
      });
      break;
    case 'replay':
      (frame.replay || []).forEach((entry) => {
        this.appendOutput(entry.sequence, entry.data);
      });
      break;
    case 'output':
      this.appendOutput(frame.sequence, frame.data);
      if (this.get('status') !== 'connected') {
        this.set('status', 'connected');
        this.get('workspace').updateSession(this.get('entry'), {status: 'connected'});
      }
      break;
    case 'status':
      this.set('status', frame.status);
      this.get('workspace').updateSession(this.get('entry'), {
        status: frame.status,
        lastActivity: frame.lastActivity,
      });
      break;
    case 'error':
      this.set('status', 'error');
      this.get('workspace').updateSession(this.get('entry'), {status: 'error'});
      break;
    }
  },

  appendOutput(sequence, payload) {
    if (!payload || (sequence && sequence <= this.get('lastSequence'))) {
      return;
    }
    if (sequence) {
      this.set('lastSequence', sequence);
    }

    let body = this.$('.workspace-log-body')[0];
    if (!body) {
      return;
    }
    let $body = $(body);
    let shouldFollow = ($body.scrollTop() + $body.outerHeight() + 10) >= body.scrollHeight;
    let parsed = parseLogPayload(payload);

    parsed.lines.forEach((line) => {
      let match = line.match(/^\[?([^ \]]+)\]?\s?/);
      let message;
      let date;
      if (match) {
        message = line.substr(match[0].length);
        date = formatDateTime(match[1]);
      } else {
        message = line;
        date = this.get('intl').t('containerLogs.unknownDate');
      }

      body.insertAdjacentHTML('beforeend',
        `<div class="log-msg ${typeClass[parsed.type]}">` +
          `<span class="log-date">${Util.escapeHtml(date)}</span>` +
          this._ansiUp.ansi_to_html(Util.escapeHtml(message)) +
        '</div>'
      );
    });

    if (shouldFollow) {
      next(this, () => this.send('scrollToBottom'));
    }
  },

  scheduleReconnect() {
    this.cancelReconnect();
    let attempt = this.incrementProperty('reconnectAttempts');
    let delay = Math.min(10000, 500 * Math.pow(2, Math.min(attempt, 5)));
    this._reconnectTimer = later(this, () => {
      this.set('createAttempted', false);
      this.connect(false);
    }, delay);
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
});

export {
  LOG_WRAP_STORAGE_KEY,
  parseLogPayload,
  readLogWrapPreference,
  saveLogWrapPreference,
};
