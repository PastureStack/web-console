import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../core.mjs';

const detail = 'BRIDGE_PROJECT_BINDING_REQUIRED', secret = 'private-source-sentinel-never-echo';
const config = {endpoint: 'http://127.0.0.1:8888', environment: 'Before', accessKey: 'source-key', secretKey: secret};
const project = {id: 'p1', uuid: 'adminProject', name: 'Before', state: 'active'};
const response = body => new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json',
  'X-PastureStack-Key-Purpose': 'ai-bridge', 'X-PastureStack-Key-Revision': '7'}});

test('real Core serializer sends only negotiated fixed detail and legacy ACK stays wire compatible', async () => {
  for (const capability of [true, false, 'invalid']) {
    const events = [], paths = []; let plans = 0;
    const bridge = await createBridge(config, {fetcher: async (url, options) => {
      paths.push(url.pathname); const body = options.body ? JSON.parse(options.body) : null;
      if (url.pathname.endsWith('/projects')) return response({data: [project]});
      if (url.pathname.endsWith('/projects/p1')) return response(project);
      if (url.pathname.endsWith('/aiResourceViews')) return response({resourceType: 'project', data: [project], nextMarker: null});
      if (url.pathname.endsWith('/aiToolCallEvents')) {
        events.push(body); return response({accepted: true, requestId: 'ack-' + events.length,
          ...(body.phase === 'start' && capability ? {supportedReasonDetails: capability === true ? [detail] : detail} : {})});
      }
      if (url.pathname.endsWith('/aiResourceChangePlans')) plans++;
      throw new Error(secret);
    }});
    const found = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    const result = await bridge.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata',
      targetRef: found.items[0].resourceRef, parameters: {name: 'After'}});
    assert.equal(result.code, 'NEEDS_USER'); assert.equal(result.reason, detail); assert.equal(plans, 0);
    const event = events.at(-1); assert.equal(event.reason, 'NEEDS_USER');
    if (capability === true) assert.equal(event.reasonDetail, detail);
    else assert.equal(Object.hasOwn(event, 'reasonDetail'), false);
    assert.equal(paths.some(path => path.includes('/schemas')), false); assert.equal(bridge.tools.length, 12);
    assert.equal(JSON.stringify(events).includes(secret), false); bridge.close();
  }
});

test('Core records fixed completion warning and recovery state even for unexpected refresh setup failures', async () => {
  for (const failure of ['transport', 'hidden', 'unexpected-setup']) {
    const row = {...project}, events = []; let done = false, reads = 0, applies = 0, failed = false;
    const plan = {id: 'aichange-33333333-3333-3333-3333-333333333333', resourceType: 'project', operation: 'update_metadata', resourceId: 'p1',
      targetPath: 'untrusted-plan-label', status: 'preview', confirmationState: 'pending', verifiedResult: false,
      changes: [{field: 'name', before: 'Before', after: 'After'}]};
    const bound = {...config, environmentBinding: {endpoint: config.endpoint, id: 'p1', uuid: 'adminProject'}};
    const bridge = await createBridge(bound, {fetcher: async (url, options) => {
      if (url.pathname.endsWith('/aiToolCallEvents')) { events.push(JSON.parse(options.body)); return response({accepted: true, requestId: 'ack-' + events.length}); }
      if (url.pathname.endsWith('/aiResourceViews')) return response({resourceType: 'project', data: [row], nextMarker: null});
      if (url.pathname.endsWith('/aiResourceChangePlans')) return response(plan);
      if (url.pathname.endsWith('/' + plan.id)) {
        if (options.method === 'POST') { applies++; plan.status = 'accepted'; return response(plan); }
        done = true; row.name = 'Native name'; plan.status = 'succeeded'; plan.verifiedResult = true; return response(plan);
      }
      if (url.pathname.endsWith('/projects/p1')) {
        if (done) {
          reads++;
          if (failure === 'hidden') return new Response(JSON.stringify({code: 'NotFound', message: secret}), {status: 404});
          if (failure === 'transport' && !failed) { failed = true; throw new Error(secret); }
        }
        return response(row);
      }
      throw new Error(secret);
    }});
    const found = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    const preview = await bridge.engine.execute('preview_resource_change', {resourceType: 'project', operation: 'update_metadata',
      targetRef: found.items[0].resourceRef, parameters: {name: 'After'}});
    plan.confirmationState = 'approved';
    const submitted = await bridge.engine.execute('apply_resource_change', {planRef: preview.planRef});
    if (failure === 'unexpected-setup') {
      const observe = bridge.engine.onOperation;
      bridge.engine.onOperation = notice => observe(notice, {get startedAt() { throw new Error(secret); }});
    }
    const completed = await bridge.engine.execute('get_operation', {operationRef: submitted.operationRef});
    assert.equal(completed.status, 'succeeded'); assert.equal(completed.verifiedResult, true); assert.equal(applies, 1);
    const warning = completed.warnings[0];
    assert.equal(warning.reason, failure === 'hidden' ? 'BRIDGE_PROJECT_LABEL_REFRESH_BLOCKED' : 'BRIDGE_PROJECT_LABEL_REFRESH_PENDING');
    assert.equal(warning.retryable, failure !== 'hidden'); assert.equal(JSON.stringify(completed).includes(secret), false);
    const before = reads, next = await bridge.engine.execute('find_resources', {family: 'environment', resourceType: 'project'});
    if (failure === 'hidden') { assert.equal(next.code, 'FORBIDDEN'); assert.equal(reads, before); }
    else { assert.equal(next.status, 'succeeded'); assert.equal(reads, before + 1); assert.equal(bridge.engine.context.capture().projectName, 'Native name'); }
    assert.equal(applies, 1); bridge.close();
  }
});
