import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, CommandContext, CommandEngine} from '../bridge/shared-modules.mjs';

test('find_services explains both safe lookup paths without requiring an opaque filter', () => {
  const tool = COMMANDS.find(row => row.name === 'find_services');
  assert.deepEqual(tool.inputSchema.required, ['query']);
  assert.match(tool.description, /query only/);
  assert.match(tool.inputSchema.properties.stackRef.description, /Never put a Stack name or ID/);
  assert.match(tool.inputSchema.properties.stackRef.description, /find_stacks/);
  assert.match(tool.inputSchema.properties.stackRef.description, /stackName/);
});

for (const transportKind of ['browser', 'stdio']) {
  test(`${transportKind}: a guessed Stack reference stays rejected and safe query-only recovery returns candidates`, async () => {
    const snapshot = {generation: 'g1', accountId: 'a1', projectId: 'p1', projectName: 'QA', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
    let nonce = 0;
    const context = new CommandContext(() => snapshot, () => String(++nonce));
    context.setMode('enabled');
    const requests = [];
    const engine = new CommandEngine({context, transportKind, ensureSession: async () => {},
      audit: async () => ({accepted: true, requestId: `audit-${++nonce}`}),
      request: async request => {
        requests.push(request);
        assert.equal(request.method, 'GET');
        if (request.url.startsWith('projects/p1/services?')) return {body: {data: [
          {id: 's1', accountId: 'p1', stackId: 'st1', name: 'same-name', description: ''},
          {id: 's2', accountId: 'p1', stackId: 'st2', name: 'same-name', description: ''},
        ]}};
        assert.equal(request.url, 'projects/p1/stacks?limit=1000');
        return {body: {data: [{id: 'st1', accountId: 'p1', name: 'first'}, {id: 'st2', accountId: 'p1', name: 'selected'}]}};
      }});
    const rejected = await engine.execute('find_services', {query: 'same-name', stackRef: 'PRIVATE-GUESSED-NAME'});
    assert.equal(rejected.code, 'STALE_REFERENCE');
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.field, 'stackRef');
    assert.match(rejected.nextStep, /query only/);
    assert.match(rejected.nextStep, /find_stacks/);
    assert.equal(JSON.stringify(rejected).includes('PRIVATE-GUESSED-NAME'), false);
    assert.equal(requests.length, 0);
    const other = await engine.execute('get_service', {serviceRef: 'PRIVATE-GUESSED-SERVICE'});
    assert.equal(other.code, 'STALE_REFERENCE');
    assert.equal(other.nextStep, 'Search again and reuse the new reference unchanged.');
    assert.equal(requests.length, 0);
    const recovered = await engine.execute('find_services', {query: 'same-name'});
    assert.equal(recovered.status, 'succeeded');
    assert.deepEqual(recovered.items.map(row => row.stackName), ['first', 'selected']);
    assert.equal(new Set(recovered.items.map(row => row.serviceRef)).size, 2);
    assert.equal(recovered.items.some(row => row.serviceRef === 's1' || row.serviceRef === 's2'), false);
    assert.equal(requests.length, 2);
  });
}
