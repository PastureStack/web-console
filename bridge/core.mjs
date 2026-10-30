import {open, realpath, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {CommandContext, CommandEngine, COMMANDS, CommandError, resourceDescriptors} from './shared-modules.mjs';

export class SetupError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['endpoint', 'environment', 'accessKey', 'secretKey'].includes(key))) {
    throw new SetupError('INVALID_CONFIG');
  }
  for (const name of ['endpoint', 'environment', 'accessKey', 'secretKey']) {
    if (typeof input[name] !== 'string' || !input[name] || input[name].length > 2048) {
      throw new SetupError('INVALID_CONFIG');
    }
  }
  let endpoint;
  try { endpoint = new URL(input.endpoint); } catch { throw new SetupError('INVALID_ENDPOINT'); }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) {
    throw new SetupError('HTTPS_REQUIRED');
  }
  return Object.freeze({...input, endpoint: endpoint.href.replace(/\/$/, '')});
}

const CONFIG_LIMIT = 16 * 1024;
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;

export async function loadConfig(input, io = {open, realpath, lstat}) {
  let file;
  try {
    if (typeof input !== 'string' || !input || input.includes('\0')) throw new SetupError('CONFIG_UNREADABLE');
    // The launcher selects the directory; tool arguments never reach this API.
    const selected = path.resolve(input);
    const parent = await io.realpath(path.dirname(selected));
    const target = await io.realpath(selected);
    const relative = path.relative(parent, target);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new SetupError('CONFIG_UNREADABLE');
    }
    const before = await io.lstat(target);
    if (!before.isFile() || before.isSymbolicLink() || before.size > CONFIG_LIMIT) throw new SetupError('INVALID_CONFIG');
    file = await io.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const opened = await file.stat();
    if (!sameFile(before, opened) || !opened.isFile() || opened.size > CONFIG_LIMIT ||
        await io.realpath(selected) !== target || await io.realpath(parent) !== parent) {
      throw new SetupError('CONFIG_UNREADABLE');
    }
    // Bound allocation and reads even if a writer grows the file after stat.
    const bytes = Buffer.alloc(CONFIG_LIMIT + 1);
    let length = 0;
    while (length < bytes.length) {
      const {bytesRead} = await file.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await file.stat();
    const namedAfter = await io.lstat(target);
    if (length > CONFIG_LIMIT) throw new SetupError('INVALID_CONFIG');
    if (!sameFile(opened, after) || !sameFile(opened, namedAfter) || namedAfter.isSymbolicLink() ||
        opened.size !== after.size || opened.mtimeMs !== after.mtimeMs ||
        opened.ctimeMs !== after.ctimeMs || await io.realpath(selected) !== target) throw new SetupError('CONFIG_UNREADABLE');
    return validateConfig(JSON.parse(bytes.subarray(0, length).toString('utf8')));
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError('CONFIG_UNREADABLE');
  } finally {
    await file?.close().catch(() => {});
  }
}

const PATH = /^projects\/([a-zA-Z0-9_-]+)\/(stacks|services|aiServiceUpgradePlans|aiResourceChangePlans|aiCatalogStackLaunchPlans|aiServiceDescriptionUpdates|aiToolCallEvents)(?:\/([a-zA-Z0-9_-]+))?$/;

export function allowedRequest(path, method, projectId, bootstrap = false) {
  if (typeof path !== 'string') return false;
  const parsed = new URL(path, 'https://local.invalid/');
  if (parsed.origin !== 'https://local.invalid' || parsed.hash || parsed.pathname.slice(1) !== path.split('?')[0]) return false;
  if (path === 'pasturestack/ai-audit-queries' && method === 'POST') return true;
  if (method === 'POST' && ['aiResourceViews', 'aiCatalogMetadataViews', 'aiCatalogStackLaunchOptions'].some(kind => parsed.pathname === `/projects/${projectId}/${kind}`) && !parsed.search) return true;
  if (bootstrap && method === 'GET' && parsed.pathname === '/projects') {
    return [...parsed.searchParams.keys()].every(key => ['limit', 'marker'].includes(key));
  }
  if (method === 'GET') {
    const queryAllowed = [...parsed.searchParams.keys()].every(key => ['limit', 'marker', 'stackId', 'serviceId', 'storagePoolId'].includes(key));
    if (!queryAllowed) return false;
    const read = resourceDescriptors().find(item => {
      if (!item.bridgeRead) return false;
      const root = item.scope === 'global' ? `/${item.collection}` : `/projects/${projectId}/${item.collection}`;
      return parsed.pathname === root || parsed.pathname.startsWith(root + '/') && /^[a-zA-Z0-9_.:-]{1,256}$/.test(parsed.pathname.slice(root.length + 1));
    });
    if (read) return true;
  }
  const match = parsed.pathname.slice(1).match(PATH);
  if (!match || match[1] !== projectId) return false;
  const [, , kind, id] = match;
  if (method === 'GET') {
    return ['stacks', 'services'].includes(kind) || ['aiServiceUpgradePlans', 'aiResourceChangePlans', 'aiCatalogStackLaunchPlans'].includes(kind) && !!id;
  }
  if (method !== 'POST') return false;
  if (['aiServiceUpgradePlans', 'aiResourceChangePlans', 'aiCatalogStackLaunchPlans'].includes(kind)) {
    return id ? parsed.searchParams.get('action') === 'apply' && [...parsed.searchParams.keys()].length === 1 : !parsed.search;
  }
  return !id && !parsed.search && ['aiServiceDescriptionUpdates', 'aiToolCallEvents'].includes(kind);
}

export function createTransport(config, fetcher = fetch) {
  const base = new URL(config.endpoint + '/v2-beta/');
  // The credential never enters tool arguments, returned data, URLs, or logs.
  const authorization = 'Basic ' + Buffer.from(config.accessKey + ':' + config.secretKey).toString('base64');
  let verifiedRevision = null;
  return async function request({url, method = 'GET', data, signal}, projectId, bootstrap = false) {
    if (!allowedRequest(url, method, projectId, bootstrap)) throw new CommandError('FORBIDDEN');
    const deadline = url === 'pasturestack/ai-audit-queries' ? 55000 : 15000;
    const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(deadline)]) : AbortSignal.timeout(deadline);
    let response;
    try {
      response = await fetcher(new URL(url, base), {method, redirect: 'error', credentials: 'omit', signal: combined,
        headers: {'Authorization': authorization, 'Accept': 'application/json',
          ...(verifiedRevision === null ? {} : {'X-PastureStack-Key-Expected-Revision': verifiedRevision}),
          ...(data === undefined ? {} : {'Content-Type': 'application/json'})},
        body: data === undefined ? undefined : JSON.stringify(data)});
    } catch { throw new CommandError(signal?.aborted ? 'CANCELLED' : 'UNKNOWN_RESULT'); }
    if (response.ok) {
      const purpose = response.headers.get('X-PastureStack-Key-Purpose');
      const revision = response.headers.get('X-PastureStack-Key-Revision');
      if (purpose !== 'ai-bridge' || !/^[0-9]+$/.test(revision || '')) {
        await response.body?.cancel();
        throw bootstrap ? new SetupError('DEDICATED_KEY_REQUIRED') : new CommandError('FORBIDDEN');
      }
      if (verifiedRevision !== null && revision !== verifiedRevision) {
        await response.body?.cancel();
        throw new CommandError('CONTEXT_CHANGED');
      }
      verifiedRevision = revision;
    }
    if (!response.body) throw new CommandError('INVALID_RESPONSE');
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 1024 * 1024) { await reader.cancel(); throw new CommandError('INVALID_RESPONSE'); }
      chunks.push(part.value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks, length).toString('utf8')); }
    catch { throw new CommandError('INVALID_RESPONSE'); }
    if (!response.ok) {
      throw {status: response.status, body: {code: typeof body?.code === 'string' ? body.code : undefined}};
    }
    return {body};
  };
}

export async function createBridge(config, {fetcher, random = () => randomBytes(24).toString('hex')} = {}) {
  config = validateConfig(config);
  const transport = createTransport(config, fetcher);
  let path = 'projects?limit=100', selected = [];
  for (let page = 0; path && page < 20; page++) {
    const {body} = await transport({url: path}, null, true);
    if (!Array.isArray(body.data)) throw new SetupError('INVALID_ENVIRONMENT_RESPONSE');
    selected.push(...body.data.filter(item => item.name === config.environment && item.state === 'active' && typeof item.id === 'string'));
    const next = body.pagination?.next;
    if (!next) { path = null; break; }
    const nextUrl = new URL(next, config.endpoint + '/v2-beta/');
    const base = new URL(config.endpoint + '/v2-beta/projects');
    if (nextUrl.origin !== base.origin || nextUrl.pathname !== base.pathname || nextUrl.username || nextUrl.password || nextUrl.hash) {
      throw new SetupError('INVALID_ENVIRONMENT_PAGE');
    }
    path = 'projects' + nextUrl.search;
  }
  if (path) throw new SetupError('ENVIRONMENT_SCAN_LIMIT');
  if (selected.length !== 1) throw new SetupError(selected.length ? 'AMBIGUOUS_ENVIRONMENT' : 'ENVIRONMENT_NOT_VISIBLE');
  const project = selected[0];
  const snapshot = {generation: random(), accountId: config.accessKey, projectId: project.id,
    projectName: project.name, schemaProjectId: project.id, schemaGeneration: 1, route: 'stdio'};
  const context = new CommandContext(() => snapshot, random);
  context.setMode('enabled');
  const request = options => transport(options, project.id);
  const engine = new CommandEngine({context, request, ensureSession: async () => {},
    audit: async event => {
      const data = {command: event.command, phase: event.phase, status: event.status, reason: event.reason};
      if (event.correlationId) data.correlationId = event.correlationId;
      return (await request({url: `projects/${project.id}/aiToolCallEvents`, method: 'POST', data})).body;
    }, transportKind: 'stdio', origin: new URL(config.endpoint).origin, apiEndpoint: new URL(config.endpoint).pathname.replace(/\/$/, '') + '/v2-beta'});
  return {engine, tools: COMMANDS, close() { context.setMode('off'); }};
}
