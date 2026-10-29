import { CommandError } from './ai-command-contract';

const RESOURCE_TYPE = 'catalogTemplate';
const VERSION_TYPE = 'catalogTemplateVersion';
const PAGE_SIZE = 50;
const ID = /^ctm-[0-9a-f]{64}$/;
const VERSION_ID = /^cvm-[0-9a-f]{64}$/;
const CURSOR = /^cmc-[A-Za-z0-9_-]{76}$/;
const FIELDS = ['name', 'description', 'catalogId', 'templateBase', 'templateKey', 'catalogScope', 'defaultVersion', 'maintainer', 'license'];
const VERSION_FIELDS = ['version', 'minimumRancherVersion', 'maximumRancherVersion', 'upgradeFrom'];

function invalid(field) { throw new CommandError('INVALID_INPUT', field); }
function responseInvalid() { throw new CommandError('INVALID_RESPONSE'); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function identifier(value, field, pattern = ID) { if ( typeof value !== 'string' || !pattern.test(value) ) { invalid(field); } return value; }
function cursor(value, prefix = 'ctm-') {
  if ( typeof value !== 'string' || !CURSOR.test(value) ) { return null; }
  let bytes;
  try { bytes = globalThis.atob(value.slice(4).replace(/-/g, '+').replace(/_/g, '/')); } catch (error) { return null; }
  if ( bytes.length !== 57 || bytes.charCodeAt(0) !== 1 ) { return null; }
  let row = 0n;
  for ( let i = 1; i < 9; i++ ) { row = row * 256n + BigInt(bytes.charCodeAt(i)); }
  if ( row <= 0n || row > 9223372036854775807n ) { return null; }
  let digest = '';
  for ( let i = 9; i < 41; i++ ) { digest += bytes.charCodeAt(i).toString(16).padStart(2, '0'); }
  return {row, id: `${prefix}${digest}`};
}
function input(value, allowed) {
  if ( !object(value) || Object.keys(value).some((key) => !allowed.includes(key)) ) { invalid(); }
}
function project(row, templateId = null) {
  const version = templateId !== null;
  const fields = version ? VERSION_FIELDS : FIELDS;
  const resourceType = version ? VERSION_TYPE : RESOURCE_TYPE;
  if ( !object(row) || typeof row.id !== 'string' || !(version ? VERSION_ID : ID).test(row.id) || row.type !== resourceType ) { responseInvalid(); }
  const result = {id: row.id, type: resourceType};
  const truncated = new Set();
  if ( row.truncatedFields !== undefined ) {
    if ( !Array.isArray(row.truncatedFields) || row.truncatedFields.length > fields.length ||
      row.truncatedFields.some((field) => !fields.includes(field)) ) { responseInvalid(); }
    row.truncatedFields.forEach((field) => truncated.add(field));
  }
  for ( const field of fields ) {
    const value = row[field];
    if ( value === undefined || value === null ) { continue; }
    if ( typeof value !== 'string' ) { responseInvalid(); }
    const limit = field === 'description' ? 1024 : 512;
    result[field] = value.slice(0, limit);
    if ( value.length > limit ) { truncated.add(field); }
  }
  if ( version ) {
    if ( row.templateId !== templateId || typeof result.version !== 'string' ||
      row.revision !== null && row.revision !== undefined && (!Number.isSafeInteger(row.revision) || row.revision < 0) ) { responseInvalid(); }
    result.templateId = templateId;
    result.revision = row.revision === undefined ? null : row.revision;
  } else if ( typeof result.name !== 'string' || !['global', 'project'].includes(result.catalogScope) ||
    typeof row.templateKey !== 'string' || !row.templateKey || row.templateKey === '.' || row.templateKey === '..' ||
    row.templateKey.length > 512 || Array.from(row.templateKey).some((value) => value.charCodeAt(0) < 0x20 || value.charCodeAt(0) === 0x7f || '/\\:'.includes(value)) ) { responseInvalid(); }
  if ( truncated.size ) { result.truncatedFields = [...truncated].sort(); }
  return result;
}

// A trusted authorized-request function is injected by the browser or bridge.
// No credentials, arbitrary endpoint, URL, method, projection or fetch enter this adapter.
export function createCatalogReader({request, context}) {
  if ( typeof request !== 'function' || !context || typeof context.assertCurrent !== 'function' ) { throw new TypeError('Catalog reader requires an authorized request and command context'); }
  async function read(data, captured, signal) {
    context.assertCurrent(captured, signal);
    if ( !captured || typeof captured.projectId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(captured.projectId) ) { throw new CommandError('UNAVAILABLE'); }
    let response;
    try {
      response = await request({url: `projects/${encodeURIComponent(captured.projectId)}/aiCatalogMetadataViews`, method: 'POST', data, signal});
    } catch (error) { context.assertCurrent(captured, signal); throw error; }
    context.assertCurrent(captured, signal);
    const body = response && response.body;
    const resourceType = data.versions ? VERSION_TYPE : RESOURCE_TYPE;
    if ( !object(body) || body.resourceType !== resourceType || !Array.isArray(body.data) || body.data.length > PAGE_SIZE ) { responseInvalid(); }
    const rows = body.data.map((row) => project(row, data.versions ? data.templateId : null));
    if ( new Set(rows.map((row) => row.id)).size !== rows.length ) { responseInvalid(); }
    const next = body.nextMarker;
    const point = next === null || next === undefined ? null : cursor(next, data.versions ? 'cvm-' : 'ctm-');
    if ( next !== null && next !== undefined && !point ) { responseInvalid(); }
    if ( point && (!rows.length || point.id !== rows[rows.length - 1].id || data.marker && point.row <= cursor(data.marker).row) ) { responseInvalid(); }
    return {resourceType, data: rows, nextMarker: next || null};
  }
  return Object.freeze({
    async find(value, captured, signal) {
      input(value, ['query', 'marker']);
      const data = {};
      if ( value.query !== undefined ) {
        if ( typeof value.query !== 'string' || value.query.length > 256 || value.query.includes('\0') ) { invalid('query'); }
        data.query = value.query;
      }
      if ( value.marker !== undefined && value.marker !== null ) {
        if ( !cursor(value.marker) ) { invalid('marker'); }
        data.marker = value.marker;
      }
      return read(data, captured, signal);
    },
    async get(value, captured, signal) {
      input(value, ['id']);
      const templateId = identifier(value.id, 'id');
      const result = await read({templateId}, captured, signal);
      if ( result.data.length !== 1 || result.data[0].id !== templateId || result.nextMarker !== null ) { responseInvalid(); }
      return result;
    },
    async findVersions(value, captured, signal) {
      input(value, ['templateId', 'marker']);
      const data = {templateId: identifier(value.templateId, 'templateId'), versions: true};
      if ( value.marker !== undefined && value.marker !== null ) {
        if ( !cursor(value.marker, 'cvm-') ) { invalid('marker'); }
        data.marker = value.marker;
      }
      return read(data, captured, signal);
    },
    async getVersion(value, captured, signal) {
      input(value, ['templateId', 'versionId']);
      const templateId = identifier(value.templateId, 'templateId');
      const versionId = identifier(value.versionId, 'versionId', VERSION_ID);
      const result = await read({templateId, versions: true, versionId}, captured, signal);
      if ( result.data.length !== 1 || result.data[0].id !== versionId || result.nextMarker !== null ) { responseInvalid(); }
      return result;
    },
  });
}
