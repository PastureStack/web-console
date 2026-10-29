import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';
import {allowedRequest, createBridge} from '../bridge/core.mjs';

const secret = 'PRIVATE_COMPOSE_OR_CREDENTIAL_MUST_NOT_LEAVE';
const logical = value => 'ctm-' + createHash('sha256').update(value).digest('hex');
const versionId = value => 'cvm-' + createHash('sha256').update(value).digest('hex');
const template = (value, extra = {}) => ({id: logical(value), type: 'catalogTemplate', name: 'Database',
  catalogId: 'library', templateBase: 'infra', templateKey: 'database', catalogScope: 'global', defaultVersion: '1.0', ...extra});
const page = (data, nextMarker = null) => ({body: {resourceType: 'catalogTemplate', data, nextMarker}});
function marker(row, id) {
  const bytes = Buffer.alloc(57); bytes[0] = 1; bytes.writeBigUInt64BE(BigInt(row), 1);
  Buffer.from(id.slice(4), 'hex').copy(bytes, 9); return 'cmc-' + bytes.toString('base64url');
}
function fixture(handle, options = {}) {
  const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'Environment', schemaProjectId: 'p1', schemaGeneration: 1, route: '/catalog'};
  let sequence = 0;
  const context = new CommandContext(() => snapshot, () => 'opaque-' + ++sequence); context.setMode('enabled');
  const requests = [], audits = [];
  const engine = new CommandEngine({context, transportKind: options.transportKind || 'browser', ensureSession: async () => {},
    audit: async event => { audits.push(event); return options.audit ? options.audit(event) : {accepted: true, requestId: 'audit-' + audits.length}; },
    request: async request => { requests.push(request); return handle(request); }});
  return {engine, context, snapshot, requests, audits};
}

test('catalog integration: closed generic schemas discover template and version reads but leave administration pending', async () => {
  const f = fixture(() => { throw Error('No metadata request is needed'); }, {transportKind: 'stdio'});
  const result = await f.engine.execute('list_capabilities', {});
  const catalog = result.families.find(item => item.family === 'catalog');
  assert.equal(COMMANDS.length, 12); assert.equal(f.requests.length, 0);
  assert.equal(catalog.coverageStatus, 'pending-adapter');
  const descriptor = catalog.resources.find(item => item.resourceType === 'catalogTemplate');
  assert.equal(descriptor.coverageStatus, 'implemented'); assert.equal(descriptor.canFind, null);
  assert.equal(descriptor.authorization, 'requires-server-check'); assert.deepEqual(descriptor.operations, []);
  const versions = catalog.resources.find(item => item.resourceType === 'catalogTemplateVersion');
  assert.equal(versions.coverageStatus, 'implemented'); assert.equal(versions.parentType, 'catalogTemplate'); assert.equal(versions.parentRequired, true);
  assert.match(catalog.reason, /do not establish compatibility/);
  for (const field of ['url', 'id', 'method', 'headers', 'templateId', 'versionId']) {
    assert.equal(Object.hasOwn(COMMANDS.find(item => item.name === 'find_resources').inputSchema.properties, field), false);
  }
});

test('catalog integration: version selection is exact, parent-scoped and carries no launch files or claimed compatibility', async () => {
  const parent = template('parent'), selectedId = versionId('v1');
  const versions = [{id: selectedId, type: 'catalogTemplateVersion', templateId: parent.id, version: '1.0', revision: 3,
    minimumRancherVersion: '1.6.0', maximumRancherVersion: '2.0.0', upgradeFrom: '^0.9', files: secret, defaultAnswers: secret},
  {id: versionId('v2'), type: 'catalogTemplateVersion', templateId: parent.id, version: '1.0', revision: 4}];
  const f = fixture(({url,data}) => {
    if(url.endsWith('/aiCatalogStackLaunchOptions'))throw {status:403};
    return data.versions ? {body: {resourceType: 'catalogTemplateVersion', data: data.versionId ? [versions[0]] : versions}} : page([parent]);
  });
  const found = await f.engine.execute('find_resources', {family: 'catalog', query: 'Database'});
  const parentRef = found.items[0].resourceRef;
  const listed = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef});
  assert.equal(listed.status, 'succeeded'); assert.equal(listed.items.length, 2); assert.equal(listed.complete, true);
  assert.notEqual(listed.items[0].resourceRef, listed.items[1].resourceRef);
  assert.equal(listed.items[0].parentRef, parentRef); assert.equal(listed.items[0].parentResolution, 'resolved');
  assert.equal(listed.items[0].displayPath, 'Environment/global/library/database/Database/1.0 (revision 3)');
  assert.equal(listed.items[1].displayPath, 'Environment/global/library/database/Database/1.0 (revision 4)');
  assert.match(listed.nextStep, /exact requested version/); assert.match(listed.nextStep, /not a verified compatibility/);
  const selected = await f.engine.execute('get_resource', {resourceRef: listed.items[0].resourceRef});
  assert.equal(selected.status, 'succeeded'); assert.equal(selected.parentRef, parentRef);
  assert.equal(selected.fields.version, '1.0'); assert.equal(selected.fields.revision, 3);
  assert.equal(selected.fields.upgradeFrom, '^0.9'); assert.equal(selected.fields.minimumRancherVersion, '1.6.0');
  assert.match(selected.nextStep, /Compatibility has not been verified/);
  assert.deepEqual(f.requests.map(request => request.data), [{query: 'Database'}, {templateId: parent.id, versions: true}, {templateId: parent.id, versions: true, versionId: selectedId},{templateId:parent.id,versionId:selectedId}]);
  assert.equal(selected.launchOptions.code,'FORBIDDEN');
  const text = JSON.stringify({listed, selected});
  for (const value of [secret, parent.id, selectedId]) assert.equal(text.includes(value), false);
});

test('catalog integration: versions reject missing or foreign parent and query before requesting the server', async () => {
  const f = fixture(() => page([template('parent')]));
  const found = await f.engine.execute('find_resources', {family: 'catalog'}), parentRef = found.items[0].resourceRef;
  for (const input of [{}, {parentRef: 'raw-id'}, {parentRef, query: '1.0'}]) {
    const result = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', ...input});
    assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(result.code));
    assert.match(result.nextStep, /catalogTemplate/); assert.match(result.nextStep, /no query/);
  }
  const wrongParent = f.context.reference('resource', {id: 's1', family: 'stack', resourceType: 'stack', scope: 'project'}, f.context.capture());
  assert.equal((await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef: wrongParent})).code, 'INVALID_INPUT');
  assert.equal(f.requests.length, 1);
});

test('catalog integration: version cursor and detail cannot cross the selected template or actor', async () => {
  const first = template('first'), second = template('second');
  const id = versionId('one'), next = marker(10, id);
  const f = fixture(({data}) => data.versions ? {body: {resourceType: 'catalogTemplateVersion', data: [{id, type: 'catalogTemplateVersion', templateId: first.id, version: '1', revision: null}], nextMarker: next}} : page([first, second]));
  const found = await f.engine.execute('find_resources', {family: 'catalog'});
  const a = found.items[0].resourceRef, b = found.items[1].resourceRef;
  const listed = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef: a});
  assert.equal(listed.status, 'succeeded'); assert.equal(JSON.stringify(listed).includes(next), false);
  const crossed = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef: b, cursor: listed.nextCursor});
  assert.equal(crossed.code, 'INVALID_INPUT'); assert.equal(crossed.field, 'cursor'); assert.equal(f.requests.length, 2);
  const before = await f.engine.execute('find_resources', {family: 'catalog', resourceType: 'catalogTemplateVersion', parentRef: b});
  assert.equal(before.code, 'INVALID_RESPONSE'); assert.equal('items' in before, false);
  f.snapshot.generation = 'replacement'; f.snapshot.accountId = 'other';
  assert.equal((await f.engine.execute('get_resource', {resourceRef: listed.items[0].resourceRef})).code, 'STALE_REFERENCE');
  assert.equal(f.requests.length, 3);
});

test('catalog integration: named lookup keeps same-name candidates qualified and exposes only opaque refs and safe metadata', async () => {
  const rows = [template('global', {description: 'd'.repeat(1025), files: secret, questions: secret}), template('project', {catalogScope: 'project'})];
  const f = fixture(() => page(rows));
  const result = await f.engine.execute('find_resources', {family: 'catalog', query: 'Database'});
  assert.equal(result.status, 'succeeded'); assert.equal(result.items.length, 2);
  assert.notEqual(result.items[0].resourceRef, result.items[1].resourceRef);
  assert.equal(result.items[0].displayPath, 'Environment/global/library/database/Database');
  assert.equal(result.items[1].displayPath, 'Environment/project/library/database/Database');
  assert.equal(result.items[0].fields.description.length, 1024);
  assert.deepEqual(result.items[0].truncatedFields, ['description']);
  assert.equal(result.resourceTextIsUntrusted, true);
  const text = JSON.stringify(result);
  for (const value of [secret, ...rows.map(row => row.id), 'selectedResource']) assert.equal(text.includes(value), false);
  assert.deepEqual(f.requests[0].data, {query: 'Database'});
  assert.equal(f.requests[0].url, 'projects/p1/aiCatalogMetadataViews'); assert.equal(f.requests[0].method, 'POST');
  assert.deepEqual(f.audits.map(event => event.phase), ['start', 'result']);
  assert.equal(JSON.stringify(f.audits).includes('Database'), false);
});

test('catalog integration: same-name templates from two folders are selected by the exact safe templateKey before detail', async () => {
  const rows = [template('small', {templateKey: 'mysql-small', description: 'Identical metadata'}),
    template('large', {templateKey: 'mysql-large', description: 'Identical metadata'})];
  const f = fixture(({data}) => page(data.templateId ? rows.filter(row => row.id === data.templateId) : rows));
  const found = await f.engine.execute('find_resources', {family: 'catalog', query: 'Database'});
  assert.equal(found.status, 'succeeded'); assert.equal(found.items.length, 2);
  assert.deepEqual(found.items.map(item => item.fields.templateKey), ['mysql-small', 'mysql-large']);
  assert.notEqual(found.items[0].displayPath, found.items[1].displayPath);
  assert.match(found.items[0].displayPath, /global\/library\/mysql-small\/Database$/);
  assert.match(found.items[1].displayPath, /global\/library\/mysql-large\/Database$/);
  const choice = found.items.find(item => item.fields.templateKey === 'mysql-large');
  const selected = await f.engine.execute('get_resource', {resourceRef: choice.resourceRef});
  assert.equal(selected.status, 'succeeded'); assert.equal(selected.fields.templateKey, 'mysql-large');
  assert.deepEqual(f.requests[1].data, {templateId: rows[1].id});
  assert.equal(JSON.stringify(found).includes(rows[0].id), false); assert.equal(JSON.stringify(selected).includes(rows[1].id), false);
  const longKey = 'k'.repeat(511) + 'z';
  const display = f.engine.catalogDisplayPath({...rows[0], catalogId: 'catalog'.repeat(80), templateKey: longKey}, {projectName: 'Environment'.repeat(40)});
  assert.ok(display.includes(longKey)); assert.ok(display.length <= 768);
});

test('catalog integration: detail rereads the exact authorized logical template and preserves upstream truncation warnings', async () => {
  const row = template('one', {description: 'bounded', truncatedFields: ['description'], upgradeCommand: secret});
  const f = fixture(() => page([row]), {transportKind: 'stdio'});
  const found = await f.engine.execute('find_resources', {family: 'catalog'});
  const result = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(result.status, 'succeeded'); assert.deepEqual(result.truncatedFields, ['description']);
  assert.deepEqual(f.requests[1].data, {templateId: row.id});
  assert.equal(result.fields.defaultVersion, '1.0'); assert.equal('compatible' in result.fields, false);
  assert.equal(JSON.stringify(result).includes(row.id), false); assert.equal(JSON.stringify(result).includes(secret), false);
  f.snapshot.projectId = 'p2'; f.snapshot.schemaProjectId = 'p2';
  const changed = await f.engine.execute('get_resource', {resourceRef: found.items[0].resourceRef});
  assert.equal(changed.code, 'STALE_REFERENCE'); assert.equal(f.requests.length, 2);
});

test('catalog integration: opaque pagination is bound to family, query and parent and never exposes the private marker', async () => {
  const row = template('one'), next = marker(10, row.id);
  const f = fixture(request => request.data.marker ? page([]) : page([row], next));
  const first = await f.engine.execute('find_resources', {family: 'catalog', query: 'Database'});
  assert.equal(first.complete, false); assert.ok(first.nextCursor); assert.equal(JSON.stringify(first).includes(next), false);
  const bad = await f.engine.execute('find_resources', {family: 'catalog', query: 'other', cursor: first.nextCursor});
  assert.equal(bad.code, 'INVALID_INPUT'); assert.equal(bad.field, 'cursor'); assert.equal(f.requests.length, 1);
  const second = await f.engine.execute('find_resources', {family: 'catalog', query: 'Database', cursor: first.nextCursor});
  assert.equal(second.status, 'succeeded'); assert.equal(second.complete, true);
  assert.deepEqual(f.requests[1].data, {query: 'Database', marker: next});
});

test('catalog integration: audit failure, forbidden access and invalid routing input do not become successful reads', async () => {
  const denied = fixture(() => { throw {status: 403, body: {message: secret}}; });
  const result = await denied.engine.execute('find_resources', {family: 'catalog'});
  assert.equal(result.code, 'FORBIDDEN'); assert.equal(result.status, 'rejected');
  assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(denied.requests.length, 1);
  const unavailable = fixture(() => page([]), {audit: async () => { throw Error(secret); }});
  assert.equal((await unavailable.engine.execute('find_resources', {family: 'catalog'})).code, 'UNAVAILABLE');
  assert.equal(unavailable.requests.length, 0);
  for (const input of [{family: 'catalog', url: secret}, {family: 'catalog', templateId: logical('one')},
    {family: 'catalog', resourceType: 'service'}, {family: 'catalog', parentRef: 'raw-id'}]) {
    const bad = await denied.engine.execute('find_resources', input);
    assert.ok(['INVALID_INPUT', 'STALE_REFERENCE'].includes(bad.code));
  }
  assert.equal(denied.requests.length, 1);
});

test('catalog integration: exact server errors provide read-only repair without expanding a Key policy', async () => {
  const cases = [
    [409, 'CatalogMetadataCursorStale', 'STALE_REFERENCE', /without a cursor/],
    [422, 'CatalogMetadataInputInvalid', 'INVALID_INPUT', /Correct the named field/],
    [422, 'CatalogMetadataFineGrainedUnsupported', 'UNAVAILABLE', /Do not broaden the Key policy/],
    [503, 'CatalogMetadataUnavailable', 'UNAVAILABLE', /Catalog metadata is unavailable/],
    [503, 'CatalogMetadataAuditUnavailable', 'UNKNOWN_RESULT', /unknown/],
  ];
  for (const [status, code, expected, repair] of cases) {
    const f = fixture(() => { throw {status, body: {code, message: secret}}; });
    const result = await f.engine.execute('find_resources', {family: 'catalog'});
    assert.equal(result.code, expected, code); assert.match(result.nextStep, repair, code);
    assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(f.requests.length, 1);
  }
});

test('catalog integration: a late metadata success cannot cross an actor or environment change', async () => {
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(async () => { entered(); return pending; });
  const resultPromise = f.engine.execute('find_resources', {family: 'catalog'});
  await ready; f.snapshot.generation = 'g2'; f.snapshot.accountId = 'a2'; release(page([template('old')]));
  const result = await resultPromise;
  assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal('items' in result, false);
  assert.deepEqual(f.audits.map(event => event.phase), ['start']);
});

test('catalog integration: stdio permits only the fixed scoped typed POST and never a raw catalog proxy', async () => {
  assert.equal(allowedRequest('projects/p1/aiCatalogMetadataViews', 'POST', 'p1'), true);
  for (const [url, method] of [['projects/p2/aiCatalogMetadataViews', 'POST'], ['projects/p1/aiCatalogMetadataViews?url=secret', 'POST'],
    ['projects/p1/aiCatalogMetadataViews/id', 'POST'], ['projects/p1/aiCatalogMetadataViews', 'GET'],
    ['projects/p1/proxy/http://catalog', 'GET'], ['v1-catalog/templates', 'GET']]) assert.equal(allowedRequest(url, method, 'p1'), false, url);
  const requests = [];
  const response = body => new Response(JSON.stringify(body), {headers: {'X-PastureStack-Key-Purpose': 'ai-bridge', 'X-PastureStack-Key-Revision': '1'}});
  const bridge = await createBridge({endpoint: 'http://127.0.0.1:8888', environment: 'Default', accessKey: 'public', secretKey: secret}, {
    fetcher: async (url, options) => {
      requests.push({path: url.pathname, method: options.method});
      if (url.pathname.endsWith('/projects')) return response({data: [{id: 'p1', name: 'Default', state: 'active'}]});
      if (url.pathname.endsWith('/aiToolCallEvents')) return response({accepted: true, requestId: 'ack'});
      if (url.pathname.endsWith('/aiCatalogMetadataViews')) return response(page([template('bridge')]).body);
      throw Error('Unexpected transport path');
    },
  });
  const result = await bridge.engine.execute('find_resources', {family: 'catalog', query: 'Database'});
  assert.equal(result.status, 'succeeded'); assert.equal(result.items.length, 1);
  assert.deepEqual(requests.map(item => item.path), ['/v2-beta/projects', '/v2-beta/projects/p1/aiToolCallEvents', '/v2-beta/projects/p1/aiCatalogMetadataViews', '/v2-beta/projects/p1/aiToolCallEvents']);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
