const GLOBAL_STORAGE_PREFIX = 'pasturestack.consoleWorkspace.sessions.v1.';
const TAB_STORAGE_PREFIX = 'pasturestack.consoleWorkspace.layout.v2.';
const CLIENT_STORAGE_KEY = 'pasturestack.consoleWorkspace.client.v1';
const SESSION_ID_PATTERN = /^psw_[A-Za-z0-9_-]{20,96}$/;
const CLIENT_ID_PATTERN = /^tab_[A-Za-z0-9_-]{20,96}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{40,256}$/;
const SESSION_KINDS = ['terminal', 'logs', 'vm'];
const SESSION_STATUSES = [
  'new',
  'initializing',
  'connecting',
  'connected',
  'disconnected',
  'closing',
  'ended',
  'error',
];

export function randomWorkspaceToken(byteCount = 24) {
  let bytes = new Uint8Array(byteCount);
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error('Secure browser randomness is required for console sessions');
  }
  window.crypto.getRandomValues(bytes);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function workspaceSessionId() {
  return `psw_${randomWorkspaceToken(18)}`;
}

export function workspaceSecret() {
  return randomWorkspaceToken(32);
}

export function brokerWebSocketUrl(sessionId, location = window.location) {
  let protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/v1/exec/sessions/${encodeURIComponent(sessionId)}`;
}

export function brokerWebSocketProtocols(secret, clientId) {
  return [
    'pasturestack-console-v1',
    `pasturestack-secret.${secret}`,
    `pasturestack-client.${clientId}`,
  ];
}

export function storedWorkspaceClientId(storage = window.sessionStorage) {
  try {
    let value = storage && storage.getItem(CLIENT_STORAGE_KEY);
    return CLIENT_ID_PATTERN.test(value || '') ? value : null;
  } catch (e) {
    return null;
  }
}

export function workspaceClientId(storage = window.sessionStorage, forceNew = false) {
  let existing = forceNew ? null : storedWorkspaceClientId(storage);
  if (existing) {
    return existing;
  }

  let value = `tab_${randomWorkspaceToken(18)}`;
  try {
    if (storage) {
      storage.setItem(CLIENT_STORAGE_KEY, value);
    }
  } catch (e) {
    // A usable in-memory identifier is still safer than blocking the console.
  }
  return value;
}

export function workspaceNavigationType(performanceObject = window.performance) {
  try {
    let entries = performanceObject &&
      performanceObject.getEntriesByType &&
      performanceObject.getEntriesByType('navigation');
    if (entries && entries[0] && entries[0].type) {
      return entries[0].type;
    }
  } catch (e) {
    // Fall through to the conservative ordinary-navigation behavior.
  }
  return 'navigate';
}

export function globalStorageKey(accountId) {
  return `${GLOBAL_STORAGE_PREFIX}${accountId || 'anonymous'}`;
}

export function tabStorageKey(accountId) {
  return `${TAB_STORAGE_PREFIX}${accountId || 'anonymous'}`;
}

export function defaultWorkspaceGeometry(index, viewportWidth, viewportHeight) {
  let width = Math.max(520, Math.min(900, viewportWidth - 80));
  let height = Math.max(360, Math.min(620, viewportHeight - 140));
  let offset = (index % 8) * 28;

  return {
    x: Math.max(12, Math.round((viewportWidth - width) / 2) + offset),
    y: Math.max(70, Math.round((viewportHeight - height) / 2) - 20 + offset),
    width,
    height,
    maximized: false,
    z: 1000 + index,
    state: 'open',
  };
}

export function clampWorkspaceGeometry(geometry, viewportWidth, viewportHeight) {
  let minWidth = Math.min(480, Math.max(320, viewportWidth - 24));
  let minHeight = Math.min(300, Math.max(220, viewportHeight - 90));
  let width = Math.max(minWidth, Math.min(geometry.width || minWidth, viewportWidth - 12));
  let height = Math.max(minHeight, Math.min(geometry.height || minHeight, viewportHeight - 62));
  let x = Math.max(0, Math.min(geometry.x || 0, viewportWidth - 80));
  let y = Math.max(46, Math.min(geometry.y || 46, viewportHeight - 80));

  return {
    x,
    y,
    width,
    height,
  };
}

export function terminalLogicalKey(kind, projectId, instanceId, command) {
  return [
    kind,
    projectId || '',
    instanceId || '',
    JSON.stringify(command || []),
  ].join(':');
}

export function isWorkspaceSessionRecord(value) {
  let commandValid = value && (
    value.command === null ||
    value.command === undefined ||
    (
      Array.isArray(value.command) &&
      value.command.length <= 64 &&
      value.command.every((part) => typeof part === 'string' && part.length <= 4096)
    )
  );

  return !!value &&
    typeof value === 'object' &&
    SESSION_ID_PATTERN.test(value.sessionId || '') &&
    SECRET_PATTERN.test(value.secret || '') &&
    SESSION_KINDS.indexOf(value.kind) >= 0 &&
    SESSION_STATUSES.indexOf(value.status) >= 0 &&
    typeof value.projectId === 'string' &&
    value.projectId.length > 0 &&
    value.projectId.length <= 256 &&
    typeof value.instanceId === 'string' &&
    value.instanceId.length > 0 &&
    value.instanceId.length <= 256 &&
    typeof value.logicalKey === 'string' &&
    value.logicalKey.length > 0 &&
    value.logicalKey.length <= 8192 &&
    commandValid;
}

export {
  CLIENT_ID_PATTERN,
  GLOBAL_STORAGE_PREFIX,
  SECRET_PATTERN,
  SESSION_ID_PATTERN,
  SESSION_KINDS,
  SESSION_STATUSES,
  TAB_STORAGE_PREFIX,
};
