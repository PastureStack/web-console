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
      Object.keys(input).some(key => !['endpoint', 'environment', 'accessKey', 'secretKey', 'environmentBinding'].includes(key))) {
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
  const normalized = endpoint.href.replace(/\/+$/, '');
  let binding;
  if (Object.hasOwn(input, 'environmentBinding')) {
    const value = input.environmentBinding;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'endpoint,id,uuid' || value.endpoint !== normalized ||
        !validProjectId(value.id) || !validProjectUuid(value.uuid)) throw new SetupError('INVALID_ENVIRONMENT_BINDING');
    binding = Object.freeze({...value});
  }
  return Object.freeze({...input, endpoint: normalized, ...(binding ? {environmentBinding: binding} : {})});
}

const validProjectId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
// Native Default uses "adminProject"; UUID is an opaque server identity, not RFC-only.
const validProjectUuid = value => typeof value === 'string' && value.length > 0 && value.length <= 255 && !/[\u0000-\u001f\u007f]/.test(value);

function verifyProject(project, id, uuid) {
  if (!project || project.id !== id || project.state !== 'active' || project.removed ||
      typeof project.name !== 'string' || !project.name.trim() || project.name.length > 2048 ||
      uuid !== undefined && project.uuid !== uuid) throw new SetupError('ENVIRONMENT_BINDING_MISMATCH');
  return project;
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
    return [...parsed.searchParams.keys()].every(key => ['limit', 'marker', 'all'].includes(key)) &&
      (!parsed.searchParams.has('all') || parsed.searchParams.getAll('all').length === 1 && parsed.searchParams.get('all') === 'true');
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
        throw Object.assign(new CommandError('CONTEXT_CHANGED'), {body: {code: 'ApiKeyPolicyChanged'}});
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

async function visibleByName(config, transport) {
  // Match native administrator visibility. The server still applies the
  // authenticated account's role and Key policy to every returned Project.
  let path = 'projects?limit=100&all=true', selected = [];
  for (let page = 0; path && page < 20; page++) {
    const {body} = await transport({url: path}, null, true);
    if (!Array.isArray(body.data)) throw new SetupError('INVALID_ENVIRONMENT_RESPONSE');
    selected.push(...body.data.filter(item => item.name === config.environment && item.state === 'active' && !item.removed && validProjectId(item.id)));
    const next = body.pagination?.next;
    if (!next) { path = null; break; }
    const nextUrl = new URL(next, config.endpoint + '/v2-beta/');
    const base = new URL(config.endpoint + '/v2-beta/projects');
    if (nextUrl.origin !== base.origin || nextUrl.pathname !== base.pathname || nextUrl.username || nextUrl.password || nextUrl.hash) {
      throw new SetupError('INVALID_ENVIRONMENT_PAGE');
    }
    if (nextUrl.searchParams.has('all') && (nextUrl.searchParams.getAll('all').length !== 1 || nextUrl.searchParams.get('all') !== 'true')) {
      throw new SetupError('INVALID_ENVIRONMENT_PAGE');
    }
    nextUrl.searchParams.set('all', 'true');
    path = 'projects' + nextUrl.search;
  }
  if (path) throw new SetupError('ENVIRONMENT_SCAN_LIMIT');
  if (new Set(selected.map(item => item.id)).size !== selected.length) throw new SetupError('INVALID_ENVIRONMENT_RESPONSE');
  return selected;
}

async function exactProject(transport, id, uuid, signal, bootstrap = false) {
  const {body} = await transport({url: 'projects/' + id, signal}, id, bootstrap);
  return verifyProject(body, id, uuid);
}

async function boundProject(transport, binding) {
  // Only collection discovery may precede the first server-verified Key revision.
  // Its rows never select the target: the subsequent exact GET is authoritative.
  const {body} = await transport({url: 'projects?limit=1'}, null, true);
  if (!Array.isArray(body?.data)) throw new SetupError('INVALID_ENVIRONMENT_RESPONSE');
  return exactProject(transport, binding.id, binding.uuid, undefined, true);
}

// Explicit profile preparation only. No filesystem, prompts, public tool or implicit save.
export async function prepareBoundProfile(input, {fetcher, select} = {}) {
  const config = validateConfig(input), transport = createTransport(config, fetcher);
  let project;
  if (config.environmentBinding) {
    project = await boundProject(transport, config.environmentBinding);
  } else {
    const candidates = await visibleByName(config, transport);
    if (!candidates.length) throw new SetupError('ENVIRONMENT_NOT_VISIBLE');
    let index = 0;
    if (candidates.length > 1) {
      if (typeof select !== 'function') throw new SetupError('AMBIGUOUS_ENVIRONMENT');
      index = await select(candidates.map(item => Object.freeze({name: item.name, description: item.description, created: item.created})));
      if (index === null) throw new SetupError('PROFILE_BINDING_CANCELLED');
      if (!Number.isInteger(index) || index < 0 || index >= candidates.length) throw new SetupError('AMBIGUOUS_ENVIRONMENT');
    }
    const selected = candidates[index];
    project = await exactProject(transport, selected.id, selected.uuid, undefined, true);
    if (project.name !== config.environment) throw new SetupError('ENVIRONMENT_SELECTION_CHANGED');
  }
  if (!validProjectUuid(project.uuid)) throw new SetupError('ENVIRONMENT_IDENTITY_UNAVAILABLE');
  return validateConfig({...config, environment: project.name,
    environmentBinding: {endpoint: config.endpoint, id: project.id, uuid: project.uuid}});
}

export async function createBridge(config, {fetcher, random = () => randomBytes(24).toString('hex')} = {}) {
  config = validateConfig(config);
  const transport = createTransport(config, fetcher);
  let project;
  if (config.environmentBinding) {
    project = await boundProject(transport, config.environmentBinding);
  } else {
    const selected = await visibleByName(config, transport);
    if (selected.length !== 1) throw new SetupError(selected.length ? 'AMBIGUOUS_ENVIRONMENT' : 'ENVIRONMENT_NOT_VISIBLE');
    project = selected[0];
  }
  const snapshot = {generation: random(), accountId: config.accessKey, projectId: project.id,
    projectName: project.name, schemaProjectId: project.id, schemaGeneration: 1, route: 'stdio'};
  const context = new CommandContext(() => snapshot, random);
  context.setMode('enabled');
  const projectPlans = new Set();
  let nameFailure = null, nameRetryable = false;
  const identityFailure = error => error instanceof SetupError && error.code === 'ENVIRONMENT_BINDING_MISMATCH' ? new CommandError('CONTEXT_CHANGED') : error;
  const retryableNameFailure = () => new CommandError('UNKNOWN_RESULT', 'bridge.projectLabelRefresh');
  async function refreshName(observation) {
    nameFailure = retryableNameFailure(); nameRetryable = true;
    try {
      const remaining = observation ? 5000 - (Date.now() - observation.startedAt) : 1000;
      if (remaining <= 0) throw nameFailure;
      const deadline = AbortSignal.timeout(Math.max(1, Math.min(1000, remaining)));
      const signal = observation?.signal ? AbortSignal.any([observation.signal, deadline]) : deadline;
      const captured = context.capture();
      const current = await exactProject(transport, project.id, config.environmentBinding.uuid, signal);
      context.assertCurrent(captured, signal);
      snapshot.projectName = current.name;
      nameFailure = null; nameRetryable = false;
    } catch (error) {
      const failure = identityFailure(error), status = Number(error && (error.status || error.statusCode));
      nameRetryable = !(failure instanceof SetupError || failure instanceof CommandError && ['CONTEXT_CHANGED', 'FORBIDDEN', 'SESSION_REQUIRED'].includes(failure.code) ||
        status >= 400 && status < 500 && ![408, 429].includes(status));
      // Preserve the normal tool-level hidden-resource mapping through audit admission.
      nameFailure = nameRetryable ? retryableNameFailure() : status === 404 ? new CommandError('FORBIDDEN') : failure;
      throw nameFailure;
    }
  }
  const request = options => {
    if (nameFailure && !nameRetryable) throw nameFailure;
    return transport(options, project.id);
  };
  const canRenameSelectedProject = async ({name, signal}) => {
    let current;
    try { current = await exactProject(transport, project.id, config.environmentBinding && config.environmentBinding.uuid, signal); }
    catch (error) {
      throw identityFailure(error);
    }
    return !!config.environmentBinding || current.name === name;
  };
  const engine = new CommandEngine({context, request, ensureSession: async () => {
    if (nameFailure) {
      if (!nameRetryable) throw nameFailure;
      await refreshName(null); // One read-only recovery before this command's business dispatch.
    }
  }, canRenameSelectedProject,
    onPlan: summary => {
      if (!config.environmentBinding || summary.resourceType !== 'project' || summary.operation !== 'update_metadata') return;
      const reference = context.resolve(summary.planRef, 'plan', summary.context);
      if (reference.resourceId === project.id) projectPlans.add(reference.id);
    },
    onOperation: async (operation, budget) => {
      if (!projectPlans.has(operation.planId) || operation.resourceType !== 'project' || operation.operation !== 'update_metadata' || operation.resourceId !== project.id) return;
      projectPlans.delete(operation.planId);
      if (operation.status !== 'succeeded' || operation.verifiedResult !== true) return;
      // Invoked after result audit ACK. Never replace the verified operation result.
      try { await refreshName(budget || {startedAt: Date.now()}); }
      catch { return nameRetryable ? 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING' : 'BRIDGE_PROJECT_LABEL_REFRESH_BLOCKED'; }
    },
    audit: async event => {
      const data = {command: event.command, phase: event.phase, status: event.status, reason: event.reason};
      if (event.correlationId) data.correlationId = event.correlationId;
      if (event.command === 'preview_resource_change' && event.phase === 'result' && event.status === 'needs_user' && event.reason === 'NEEDS_USER' &&
          event.reasonDetail === 'BRIDGE_PROJECT_BINDING_REQUIRED') data.reasonDetail = event.reasonDetail;
      return (await request({url: `projects/${project.id}/aiToolCallEvents`, method: 'POST', data})).body;
    }, transportKind: 'stdio', origin: new URL(config.endpoint).origin, apiEndpoint: new URL(config.endpoint).pathname.replace(/\/$/, '') + '/v2-beta'});
  return {engine, tools: COMMANDS, close() { context.setMode('off'); }};
}
