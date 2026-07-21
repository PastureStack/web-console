import Ember from 'ember';
import C from 'ui/utils/constants';
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

const GLOBAL_FIELDS = [
  'sessionId',
  'secret',
  'kind',
  'projectId',
  'instanceId',
  'instanceType',
  'resourceTitle',
  'command',
  'logicalKey',
  'status',
  'brokerReady',
  'createdAt',
  'updatedAt',
  'lastActivity',
];

const LAYOUT_FIELDS = [
  'windowState',
  'x',
  'y',
  'width',
  'height',
  'z',
  'maximized',
  'restoreX',
  'restoreY',
  'restoreWidth',
  'restoreHeight',
];

function readJson(storage, key, fallback) {
  let raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    storage.removeItem(key);
    return fallback;
  }
}

function valueFor(entry, key) {
  return entry && typeof entry.get === 'function' ? entry.get(key) : entry[key];
}

function plainObject(entry, fields) {
  let out = {};
  fields.forEach((field) => {
    let value = valueFor(entry, field);
    if (value !== undefined) {
      out[field] = value;
    }
  });
  return out;
}

export default Ember.Service.extend({
  session: Ember.inject.service(),
  projects: Ember.inject.service(),
  store: Ember.inject.service(),

  sessions: null,
  accountId: null,
  clientId: null,
  menuOpen: false,
  highestZ: 1000,
  broadcastChannel: null,

  init() {
    this._super(...arguments);
    this.set('sessions', Ember.A());
    this.set('clientId', workspaceClientId());

    this._storageHandler = (event) => {
      let accountId = this.get('accountId');
      if (accountId && event.key === globalStorageKey(accountId)) {
        this.reloadSessions();
      }
    };
    window.addEventListener('storage', this._storageHandler);

    if (window.BroadcastChannel) {
      let channel = new window.BroadcastChannel('pasturestack-console-workspace-v1');
      channel.onmessage = (event) => {
        if (event.data && event.data.accountId === this.get('accountId')) {
          this.reloadSessions();
        }
      };
      this.set('broadcastChannel', channel);
    }

    this._resizeHandler = () => this.clampOpenWindows();
    window.addEventListener('resize', this._resizeHandler);
    this.accountChanged();
  },

  willDestroy() {
    window.removeEventListener('storage', this._storageHandler);
    window.removeEventListener('resize', this._resizeHandler);
    let channel = this.get('broadcastChannel');
    if (channel) {
      channel.close();
    }
    this._super(...arguments);
  },

  accountChanged: function() {
    let accountId = this.get(`session.${C.SESSION.ACCOUNT_ID}`);
    if (accountId && accountId !== this.get('accountId')) {
      this.set('accountId', accountId);
      this.reloadSessions();
    }
  }.observes(`session.${C.SESSION.ACCOUNT_ID}`),

  activate() {
    this.accountChanged();
    this.reloadSessions();
  },

  openWindows: function() {
    return this.get('sessions').filter((entry) => entry.get('windowState') !== 'closed');
  }.property('sessions.@each.windowState'),

  minimizedWindows: function() {
    return this.get('sessions').filterBy('windowState', 'minimized');
  }.property('sessions.@each.windowState'),

  visibleWindows: function() {
    return this.get('sessions').filterBy('windowState', 'open');
  }.property('sessions.@each.windowState'),

  sessionCount: Ember.computed.alias('sessions.length'),

  openTerminal(instance, options = {}) {
    return this.openSession('terminal', instance, options);
  },

  openLogs(instance, options = {}) {
    return this.openSession('logs', instance, options);
  },

  openVmConsole(instance, options = {}) {
    return this.openSession('vm', instance, options);
  },

  openSession(kind, instance, options = {}) {
    this.activate();
    let projectId = options.projectId || this.get('projects.current.id');
    let instanceId = instance.get('id');
    let command = options.command || null;
    let logicalKey = terminalLogicalKey(kind, projectId, instanceId, command);
    let existing;

    if (!options.forceNew) {
      existing = this.get('sessions').find((entry) => {
        return entry.get('logicalKey') === logicalKey && entry.get('status') !== 'ended';
      });
    }

    if (existing) {
      if (!existing.get('instance')) {
        existing.set('instance', instance);
      }
      this.openWindow(existing);
      return existing;
    }

    let now = new Date().toISOString();
    let entry = this.decorateEntry(Ember.Object.create({
      sessionId: workspaceSessionId(),
      secret: workspaceSecret(),
      kind,
      projectId,
      instanceId,
      instanceType: kind === 'vm' ? 'virtualmachine' : (instance.get('type') || 'container').toLowerCase(),
      resourceTitle: instance.get('displayName') || instance.get('name') || instanceId,
      command,
      logicalKey,
      status: kind === 'vm' ? 'connecting' : 'new',
      brokerReady: false,
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
      instance,
      windowState: 'closed',
    }));

    this.get('sessions').pushObject(entry);
    this.openWindow(entry);
    this.saveSessions();
    return entry;
  },

  decorateEntry(entry) {
    let kind = entry.get('kind');
    entry.setProperties({
      isTerminal: kind === 'terminal',
      isLogs: kind === 'logs',
      isVm: kind === 'vm',
    });
    return entry;
  },

  loadInstance(entry) {
    let instance = entry.get('instance');
    if (instance) {
      return Ember.RSVP.resolve(instance);
    }

    let type = entry.get('instanceType') || 'container';
    if (type !== 'virtualmachine') {
      type = 'container';
    }
    return this.get('store').find(type, entry.get('instanceId')).then((loaded) => {
      if (!entry.isDestroyed) {
        entry.set('instance', loaded);
      }
      return loaded;
    });
  },

  openWindow(entry) {
    if (entry.get('windowState') === 'closed' && entry.get('width') && entry.get('height')) {
      if (entry.get('maximized')) {
        entry.setProperties({
          x: 0,
          y: 46,
          width: window.innerWidth,
          height: Math.max(300, window.innerHeight - 94),
        });
      } else {
        entry.setProperties(clampWorkspaceGeometry({
          x: entry.get('x'),
          y: entry.get('y'),
          width: entry.get('width'),
          height: entry.get('height'),
        }, window.innerWidth, window.innerHeight));
      }
      entry.setProperties({
        windowState: 'open',
        z: this.nextZ(),
      });
    } else if (entry.get('windowState') === 'closed') {
      let index = this.get('openWindows.length');
      let geometry = defaultWorkspaceGeometry(index, window.innerWidth, window.innerHeight);
      entry.setProperties({
        windowState: geometry.state,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        maximized: geometry.maximized,
        z: this.nextZ(),
      });
    } else {
      entry.setProperties({
        windowState: 'open',
        z: this.nextZ(),
      });
    }
    this.set('menuOpen', false);
    this.saveLayouts();
  },

  minimizeWindow(entry) {
    entry.set('windowState', 'minimized');
    this.saveLayouts();
  },

  closeWindow(entry) {
    entry.set('windowState', 'closed');
    this.saveLayouts();
  },

  focusWindow(entry) {
    entry.set('z', this.nextZ());
    this.saveLayouts();
  },

  nextZ() {
    let next = this.incrementProperty('highestZ');
    return next;
  },

  updateGeometry(entry, geometry) {
    let clamped = clampWorkspaceGeometry(geometry, window.innerWidth, window.innerHeight);
    entry.setProperties(clamped);
    entry.set('maximized', false);
    this.saveLayouts();
  },

  toggleMaximize(entry) {
    if (entry.get('maximized')) {
      entry.setProperties({
        x: entry.get('restoreX'),
        y: entry.get('restoreY'),
        width: entry.get('restoreWidth'),
        height: entry.get('restoreHeight'),
        maximized: false,
      });
    } else {
      entry.setProperties({
        restoreX: entry.get('x'),
        restoreY: entry.get('y'),
        restoreWidth: entry.get('width'),
        restoreHeight: entry.get('height'),
        x: 0,
        y: 46,
        width: window.innerWidth,
        height: Math.max(300, window.innerHeight - 94),
        maximized: true,
        windowState: 'open',
        z: this.nextZ(),
      });
    }
    this.saveLayouts();
    Ember.run.next(() => Ember.$(window).trigger('resize'));
  },

  clampOpenWindows() {
    this.get('sessions').forEach((entry) => {
      if (entry.get('windowState') === 'closed') {
        return;
      }
      if (entry.get('maximized')) {
        entry.setProperties({
          x: 0,
          y: 46,
          width: window.innerWidth,
          height: Math.max(300, window.innerHeight - 94),
        });
      } else {
        entry.setProperties(clampWorkspaceGeometry({
          x: entry.get('x'),
          y: entry.get('y'),
          width: entry.get('width'),
          height: entry.get('height'),
        }, window.innerWidth, window.innerHeight));
      }
    });
    this.saveLayouts();
  },

  updateSession(entry, properties) {
    properties.updatedAt = new Date().toISOString();
    if (!properties.lastActivity) {
      properties.lastActivity = properties.updatedAt;
    }
    entry.setProperties(properties);
    this.saveSessions();
  },

  brokerUrl(entry) {
    return brokerWebSocketUrl(entry.get('sessionId'));
  },

  brokerProtocols(entry) {
    return brokerWebSocketProtocols(entry.get('secret'), this.get('clientId'));
  },

  createBrokerSession(entry, access) {
    let value = (key) => {
      return access && typeof access.get === 'function' ? access.get(key) : access[key];
    };
    let url = `/v1/exec/sessions/${encodeURIComponent(entry.get('sessionId'))}`;

    return Ember.$.ajax({
      url,
      method: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      processData: false,
      data: JSON.stringify({
        secret: entry.get('secret'),
        kind: entry.get('kind'),
        target: value('url'),
        token: value('token'),
      }),
    });
  },

  terminateSession(entry) {
    if (entry.get('kind') === 'vm') {
      this.updateSession(entry, {status: 'ended'});
      this.closeWindow(entry);
      return Ember.RSVP.resolve();
    }

    this.updateSession(entry, {status: 'closing'});
    let url = `/v1/exec/sessions/${encodeURIComponent(entry.get('sessionId'))}`;

    return Ember.$.ajax({
      url,
      method: 'DELETE',
      headers: {
        'X-PastureStack-Session-Secret': entry.get('secret'),
      },
    }).then(() => {
      this.updateSession(entry, {status: 'ended'});
    }).catch((err) => {
      this.updateSession(entry, {status: 'disconnected'});
      throw err;
    });
  },

  removeHistory(entry) {
    if (entry.get('status') !== 'ended') {
      return;
    }
    this.get('sessions').removeObject(entry);
    this.saveSessions();
    this.saveLayouts();
  },

  terminateAll() {
    let sessions = this.get('sessions').slice();
    let requests = sessions.map((entry) => {
      return this.terminateSession(entry).catch(() => undefined);
    });
    return Ember.RSVP.all(requests).finally(() => {
      let accountId = this.get('accountId');
      if (accountId) {
        window.localStorage.removeItem(globalStorageKey(accountId));
        window.sessionStorage.removeItem(tabStorageKey(accountId));
      }
      this.get('sessions').clear();
    });
  },

  toggleMenu() {
    this.toggleProperty('menuOpen');
  },

  reloadSessions() {
    let accountId = this.get('accountId') || this.get(`session.${C.SESSION.ACCOUNT_ID}`);
    if (!accountId) {
      return;
    }

    this.set('accountId', accountId);
    let storedSessions = readJson(window.localStorage, globalStorageKey(accountId), []);
    let rawSessions = (Array.isArray(storedSessions) ? storedSessions : [])
      .filter((entry) => isWorkspaceSessionRecord(entry));
    let storedLayouts = readJson(
      window.sessionStorage,
      tabStorageKey(accountId),
      {}
    );
    let layouts = storedLayouts && typeof storedLayouts === 'object' && !Array.isArray(storedLayouts) ?
      storedLayouts : {};
    let existingById = {};
    this.get('sessions').forEach((entry) => {
      existingById[entry.get('sessionId')] = entry;
    });

    let next = rawSessions.map((raw) => {
      let entry = existingById[raw.sessionId];
      if (entry) {
        entry.setProperties(raw);
      } else {
        entry = Ember.Object.create(raw);
      }
      this.decorateEntry(entry);
      let layout = layouts[raw.sessionId];
      if (layout) {
        entry.setProperties(layout);
      } else if (!entry.get('windowState')) {
        entry.set('windowState', 'closed');
      }
      this.set('highestZ', Math.max(this.get('highestZ'), entry.get('z') || 1000));
      return entry;
    });

    this.get('sessions').setObjects(next);
  },

  saveSessions() {
    let accountId = this.get('accountId');
    if (!accountId) {
      return;
    }
    let raw = this.get('sessions').map((entry) => plainObject(entry, GLOBAL_FIELDS));
    window.localStorage.setItem(globalStorageKey(accountId), JSON.stringify(raw));
    let channel = this.get('broadcastChannel');
    if (channel) {
      channel.postMessage({accountId, changedAt: Date.now()});
    }
  },

  saveLayouts() {
    let accountId = this.get('accountId');
    if (!accountId) {
      return;
    }
    let raw = {};
    this.get('sessions').forEach((entry) => {
      raw[entry.get('sessionId')] = plainObject(entry, LAYOUT_FIELDS);
    });
    window.sessionStorage.setItem(
      tabStorageKey(accountId),
      JSON.stringify(raw)
    );
  },
});

export {
  GLOBAL_FIELDS,
  LAYOUT_FIELDS,
  plainObject,
  readJson,
};
