import { CommandError } from './ai-command-contract';

const PATH = 'pasturestack/ai-audit-queries';
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
const PRESENCE = ['present', 'not_projected'];
const ID_FIELDS = ['id', 'accountId', 'authenticatedAsAccountId', 'keyId', 'resourceId', 'targetId', 'processId'];
export const AUDIT_FIELDS = Object.freeze(['created', 'eventType', 'resourceType', 'authType', 'decision', 'outcome',
  'responseCode', 'httpStatus', 'requestId', 'targetType', 'operation', 'phase', 'policyRevision', 'preview',
  'processName', 'failureCode', 'interactionChannel', 'payloadsIncluded', 'requestPayloadPresence', 'responsePayloadPresence']);
const invalid = (field = 'auditFilters') => { throw new CommandError('INVALID_INPUT', field); };
const badResponse = () => { throw new CommandError('INVALID_RESPONSE'); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const token = value => typeof value === 'string' && TOKEN.test(value);
const instant = value => typeof value === 'string' && value.length <= 64 &&
  /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

export function auditFilterSignature(filters) {
  return JSON.stringify(Object.keys(filters).sort().map(key => [key, filters[key]]));
}

export function auditSafeFields(row) {
  const result = {};
  for (const field of AUDIT_FIELDS) if (Object.hasOwn(row, field)) result[field] = row[field];
  return result;
}

export function createAuditReader({request, context, resolveResource, transportKind}) {
  async function read(data, captured, signal) {
    context.assertCurrent(captured, signal);
    if (!['browser', 'stdio'].includes(transportKind)) throw new CommandError('UNAVAILABLE', 'auditFilters.transport');
    let response;
    try { response = await request({url: PATH, method: 'POST', data, signal}); }
    catch (error) {
      context.assertCurrent(captured, signal);
      const status = Number(error && error.status), code = error && error.body && error.body.code;
      if (status === 503 && ['AuditQueryUnavailable', 'AuditQueryAuditUnavailable'].includes(code)) {
        throw new CommandError('UNAVAILABLE', code === 'AuditQueryAuditUnavailable' ? 'auditFilters.audit' : 'auditFilters.service');
      }
      if (status === 422 && ['AuditQueryInputInvalid', 'AuditQueryNarrowQuery'].includes(code)) {
        invalid(code === 'AuditQueryNarrowQuery' ? 'auditFilters.timeRange' : 'auditFilters');
      }
      if (status === 502 && ['invalid_audit_response', 'invalid_key_authority', 'invalid_key_audit_scope'].includes(code)) badResponse();
      if ([500, 502, 503].includes(status) && ['audit_upstream_unavailable', 'key_audit_unavailable', 'audit_query_failed'].includes(code)) {
        throw new CommandError('UNAVAILABLE', 'auditFilters.service');
      }
      if ([400, 422].includes(Number(error && error.status)) &&
        ['result_set_too_large', 'time_range_too_large', 'incomplete_time_range', 'invalid_time_range'].includes(error.body && error.body.code)) {
        invalid('auditFilters.timeRange');
      }
      throw error;
    }
    context.assertCurrent(captured, signal);
    const body = response && response.body;
    if (!object(body) || body.resourceType !== 'auditLog' || body.payloadPolicy !== 'HUMAN_ONLY_NATIVE_AUDIT_UI' ||
      !Array.isArray(body.data) || body.data.length > 50 || !Number.isInteger(body.total) || body.total < 0 || body.total > 20000 ||
      !object(body.range) || Object.keys(body.range).some(key => !['from', 'to'].includes(key)) ||
      !instant(body.range.from) || !instant(body.range.to) ||
      Date.parse(body.range.from) >= Date.parse(body.range.to) ||
      Date.parse(body.range.to) - Date.parse(body.range.from) > 366 * 86400000 ||
      data.lastMinutes && Date.parse(body.range.to) - Date.parse(body.range.from) !== data.lastMinutes * 60000 ||
      data.from && Date.parse(data.from) !== Date.parse(body.range.from) ||
      data.to && Date.parse(data.to) !== Date.parse(body.range.to)) badResponse();
    const allowed = [...ID_FIELDS, ...AUDIT_FIELDS, 'type'];
    const rows = body.data.map(row => {
      if (!object(row) || row.type !== 'auditLog' || !token(row.id) || row.payloadsIncluded !== false ||
        !PRESENCE.includes(row.requestPayloadPresence) || !PRESENCE.includes(row.responsePayloadPresence) ||
        Object.keys(row).some(key => !allowed.includes(key)) ||
        data.environmentId && row.accountId !== data.environmentId || data.keyId && row.keyId !== data.keyId) badResponse();
      for (const field of [...ID_FIELDS, ...AUDIT_FIELDS]) {
        const value = row[field];
        if (value === undefined) continue;
        if (['preview', 'payloadsIncluded'].includes(field)) {
          if (typeof value !== 'boolean') badResponse();
        } else if (['httpStatus', 'policyRevision'].includes(field)) {
          if (!Number.isSafeInteger(value) || value < 0) badResponse();
        } else if (field === 'created') {
          if (!instant(value)) badResponse();
        } else if (!token(value)) badResponse();
      }
      return {...row};
    });
    if (new Set(rows.map(row => row.id)).size !== rows.length) badResponse();
    const offset = data.offset || 0;
    const end = Math.min(offset, body.total) + rows.length;
    if (end > body.total || (end < body.total ? body.nextOffset !== end || end <= offset : body.nextOffset !== null)) badResponse();
    return {rows, total: body.total, nextOffset: body.nextOffset, range: {...body.range}};
  }

  function query(filters, captured) {
    const data = {environmentId: captured.projectId};
    if (filters.environmentScope === 'all-visible') delete data.environmentId;
    if (filters.environmentRef) {
      if (filters.environmentScope === 'all-visible') invalid('auditFilters.environmentRef');
      const target = resolveResource(filters.environmentRef, captured, 'auditFilters.environmentRef');
      if (target.resourceType !== 'project' || target.scope !== 'global') invalid('auditFilters.environmentRef');
      data.environmentId = target.id;
    }
    if (filters.keyRef) {
      const target = resolveResource(filters.keyRef, captured, 'auditFilters.keyRef');
      if (!['apiKey', 'apiKeyRestricted'].includes(target.resourceType) || target.scope !== 'global') invalid('auditFilters.keyRef');
      data.keyId = target.id;
    }
    if (filters.lastMinutes !== undefined && (filters.from !== undefined || filters.to !== undefined)) invalid('auditFilters.timeRange');
    if (filters.from !== undefined || filters.to !== undefined) {
      if (!instant(filters.from) || !instant(filters.to) || Date.parse(filters.from) >= Date.parse(filters.to) ||
        Date.parse(filters.to) - Date.parse(filters.from) > 366 * 86400000) invalid('auditFilters.timeRange');
    }
    for (const field of ['from', 'to', 'lastMinutes', 'decision', 'outcome', 'operation', 'targetType', 'requestId', 'httpStatus', 'limit']) {
      if (filters[field] !== undefined) data[field] = filters[field];
    }
    return data;
  }
  return Object.freeze({
    async find(filters, cursor, captured, signal) {
      const selected = query(filters, captured);
      const signature = auditFilterSignature(filters);
      if (cursor && (cursor.auditFilterSignature !== signature || !object(cursor.auditQuery))) invalid('cursor');
      const data = cursor ? {...cursor.auditQuery, offset: cursor.offset} : selected;
      const result = await read(data, captured, signal);
      const frozen = {...selected, from: result.range.from, to: result.range.to};
      delete frozen.lastMinutes;
      return {...result, query: frozen, signature};
    },
    async get(target, captured, signal) {
      const result = await read({...target.auditQuery, eventId: target.id}, captured, signal);
      if (result.rows.length !== 1 || result.rows[0].id !== target.id || result.nextOffset !== null) badResponse();
      return result.rows[0];
    },
  });
}
