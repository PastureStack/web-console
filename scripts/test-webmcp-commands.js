'use strict';

// Deterministic unit tests for the production engine/adapter. No browser,
// API server, npm install, credential or generated copy of the code is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'app', 'utils');
const modules = new Map();
function moduleUrl(name) {
  if ( modules.has(name) ) { return modules.get(name); }
  const source = fs.readFileSync(path.join(root, `${name}.js`), 'utf8').replace(/from '(\.\/[^']+)'/g,
    (_, relative) => `from '${moduleUrl(relative.slice(2).replace(/\.js$/, ''))}'`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  modules.set(name, url);
  return url;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return {promise, resolve, reject};
}

async function main() {
  const {CommandContext} = await import(moduleUrl('ai-command-context'));
  const {CommandEngine, waitForOperationPoll} = await import(moduleUrl('ai-command-engine'));
  const {COMMANDS, publicError} = await import(moduleUrl('ai-command-contract'));
  const {registerCommandTools} = await import(moduleUrl('webmcp-tools'));
  let count = 0;
  const filterArgument = process.argv.find((value) => value.startsWith('--filter='));
  const filter = filterArgument ? filterArgument.slice('--filter='.length).toLowerCase() : '';
  const test = async (name, body) => {
    if ( filter && !name.toLowerCase().includes(filter) ) { return; }
    await body(); count++; process.stdout.write(`PASS ${name}\n`);
  };

  function fixture() {
    const snapshot = {generation: 'generation-one', accountId: 'actor-one', projectId: 'project-one',
      projectName: 'Selected environment', schemaProjectId: 'project-one', schemaGeneration: 1, route: '/stacks'};
    let sequence = 0, plan, operationStatus = 'accepted', verifiedResult = false, ensureCalls = 0;
    const requests = [], plans = [], audits = [];
    const descriptions = new Map([['svc-a', 'Original description'], ['svc-b', null]]);
    const context = new CommandContext(() => snapshot, () => String(++sequence).padStart(48, '0'));
    context.setMode('enabled');
    const engine = new CommandEngine({context, onPlan: (value) => plans.push(value),
      ensureSession: async () => { ensureCalls++; },
      wait: async () => {},
      audit: async (event, captured) => { audits.push({...event, projectId: captured.projectId}); return {accepted: true, requestId: `aitool-${audits.length}`}; },
      request: async (request) => {
        requests.push(request);
        const resource = request.url.replace('projects/project-one/', '');
        if ( request.method === 'GET' && resource.startsWith('stacks?') ) {
          return {body: {data: [{id: 'stack-a', accountId: 'project-one', name: 'Alpha'}, {id: 'stack-b', name: 'Beta'}]}};
        }
        if ( request.method === 'GET' && resource.startsWith('services?') ) {
          return {body: {data: [{id: 'svc-a', name: 'web', accountId: 'project-one', stackId: 'stack-a', description: descriptions.get('svc-a')},
            {id: 'svc-b', name: 'web', stackId: 'stack-b', description: descriptions.get('svc-b')}, {id: 'other-project', name: 'web', accountId: 'project-two'}]}};
        }
        if ( resource === 'services/svc-a' || resource === 'services/svc-b' ) {
          return {body: {id: resource.split('/')[1], accountId: 'project-one', name: 'web', state: 'active', scale: 2, description: descriptions.get(resource.split('/')[1]),
            actions: {upgrade: '/private-action-url'}, launchConfig: {imageUuid: 'docker:example/web:1', memory: 1048576,
              environment: {SECRET: 'SECRET_SENTINEL'}, labels: {token: 'SECRET_SENTINEL'}}}};
        }
        if ( resource === 'aiServiceDescriptionUpdates' ) {
          if ( descriptions.get(request.data.serviceId) !== request.data.expectedDescription ) {
            throw {status: 409, body: {code: 'DescriptionConflict'}};
          }
          descriptions.set(request.data.serviceId, request.data.description);
          return {body: {id: 'aidescription-fixture', serviceId: request.data.serviceId,
            description: request.data.description, status: 'succeeded', verifiedResult: true}};
        }
        if ( resource === 'aiServiceUpgradePlans' ) {
          plan = {id: 'server-plan', serviceName: 'web', currentImage: 'docker:example/web:1',
            requestedImage: request.data.image, expiresAt: '2026-10-29T10:00:00Z', confirmationState: 'pending', status: 'preview'};
          return {body: {...plan}};
        }
        if ( resource === 'aiServiceUpgradePlans/server-plan?action=confirm' ) {
          plan.confirmationState = 'approved'; return {body: {...plan}};
        }
        if ( resource === 'aiServiceUpgradePlans/server-plan?action=apply' ) {
          if ( plan.confirmationState !== 'approved' ) { throw {status: 409, body: 'SECRET_SENTINEL'}; }
          return {body: {...plan, status: operationStatus, verifiedResult}};
        }
        if ( resource === 'aiServiceUpgradePlans/server-plan' ) { return {body: {...plan, status: operationStatus, verifiedResult}}; }
        throw new Error(`Unexpected fake request ${request.url}`);
      },
    });
    return {snapshot, context, engine, requests, plans, audits, setStatus(value, verified) { operationStatus = value; verifiedResult = verified; },
      setDescription(value, id = 'svc-a') { descriptions.set(id, value); },
      ensureCalls: () => ensureCalls};
  }
  async function serviceRef(f) { return (await f.engine.execute('find_services', {query: 'web'})).items[0].serviceRef; }
  async function preview(f) { return f.engine.execute('preview_service_upgrade', {serviceRef: await serviceRef(f), image: 'example/web:2'}); }

  await test('seven bounded schemas reject extra fields before business requests and audit the rejection', async () => {
    assert.equal(COMMANDS.length, 7);
    for ( const command of COMMANDS ) {
      assert.ok(command.inputSchema.required.length <= 2);
      assert.equal(command.inputSchema.additionalProperties, false);
    }
    const f = fixture();
    for ( const input of [{query: 'web', projectId: 'elsewhere'}, {query: 'web', confirmed: true}, {query: 4}, null] ) {
      assert.equal((await f.engine.execute('find_services', input)).code, 'INVALID_INPUT');
    }
    assert.equal(f.requests.length, 0); assert.equal(f.ensureCalls(), 0);
    assert.equal(f.audits.length, 8);
    assert.deepEqual(f.audits.slice(0, 2).map((event) => [event.phase, event.status, event.reason]),
      [['start', 'pending', 'NONE'], ['result', 'rejected', 'INVALID_INPUT']]);
    assert.equal(f.audits[1].correlationId, 'aitool-1');
    assert.ok(f.audits.every((event) => Object.keys(event).every((key) =>
      ['command', 'phase', 'status', 'reason', 'correlationId', 'projectId'].includes(key))));
    assert.equal((await f.engine.execute('untrusted-command-SECRET_SENTINEL', {})).code, 'INVALID_INPUT');
    assert.ok(f.audits.slice(-2).every((event) => event.command === 'unknown'));
    assert.equal(JSON.stringify(f.audits).includes('SECRET_SENTINEL'), false);
  });

  await test('durable start ACK gates business and unavailable audit performs no business request', async () => {
    const f = fixture(), barrier = deferred(), events = [];
    f.engine.audit = async (event) => { events.push(event); return barrier.promise; };
    const pending = f.engine.execute('find_stacks', {});
    await Promise.resolve(); assert.equal(f.requests.length, 0);
    barrier.reject(new Error('audit service unavailable'));
    assert.equal((await pending).code, 'UNAVAILABLE');
    assert.equal(f.requests.length, 0); assert.equal(events.length, 1);
  });

  await test('result audit failure after apply preserves recovery reference without a second mutation', async () => {
    const f = fixture(), plan = await preview(f);
    await f.engine.confirmPlan(plan.planRef);
    const audit = f.engine.audit;
    f.engine.audit = async (event, captured) => {
      if ( event.command === 'apply_service_upgrade' && event.phase === 'result' ) { throw new Error('result ACK lost'); }
      return audit(event, captured);
    };
    const result = await f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    assert.equal(result.status, 'unknown'); assert.ok(result.operationRef);
    assert.equal(f.requests.filter((item) => item.url.endsWith('?action=apply')).length, 1);
    f.engine.audit = audit; f.setStatus('succeeded', true);
    const recovered = await f.engine.execute('get_operation', {operationRef: result.operationRef});
    assert.equal(recovered.status, 'succeeded');
    assert.equal(f.requests.filter((item) => item.url.endsWith('?action=apply')).length, 1);
  });

  await test('stale context never submits audit under the replacement session or returns stale success', async () => {
    const f = fixture(), audit = f.engine.audit, entered = deferred(), barrier = deferred(); let attempts = 0;
    f.engine.audit = async (event, captured) => {
      attempts++;
      const acknowledgement = await audit(event, captured);
      if ( event.phase === 'result' ) { entered.resolve(); await barrier.promise; }
      return acknowledgement;
    };
    const pending = f.engine.execute('find_stacks', {});
    await entered.promise; f.snapshot.generation = 'replacement-session'; barrier.resolve();
    const result = await pending;
    assert.equal(result.code, 'CONTEXT_CHANGED'); assert.equal(result.items, undefined);
    assert.equal(attempts, 2);
    assert.ok(f.audits.every((event) => event.projectId === 'project-one'));
  });

  await test('search stays in captured scope, preserves duplicate candidates and opaque references', async () => {
    const f = fixture(), result = await f.engine.execute('find_services', {query: 'web'});
    assert.deepEqual(result.items.map((item) => item.stackName), ['Alpha', 'Beta']);
    assert.equal(result.items.length, 2);
    assert.ok(f.requests.every((request) => request.url.startsWith('projects/project-one/')));
    assert.equal(JSON.stringify(result).includes('svc-a'), false);
    assert.equal((await f.engine.execute('get_service', {serviceRef: 'svc-a'})).code, 'STALE_REFERENCE');
    const detail = await f.engine.execute('get_service', {serviceRef: result.items[0].serviceRef});
    assert.equal(detail.currentImage, 'example/web:1'); assert.equal(detail.summary.memoryMiB, 1);
    assert.equal(JSON.stringify(detail).includes('SECRET_SENTINEL'), false);
    assert.equal(JSON.stringify(detail).includes('private-action'), false);
  });

  await test('description schema permits empty and UTF-16 bounded strings only', async () => {
    const command = COMMANDS.find((item) => item.name === 'update_service_description');
    assert.equal(COMMANDS.length, 7);
    assert.deepEqual(command.inputSchema.required, ['serviceRef', 'description']);
    assert.equal(command.inputSchema.additionalProperties, false);
    assert.equal(command.inputSchema.properties.description.minLength, 0);
    const f = fixture(), ref = await serviceRef(f);
    for ( const description of [undefined, null, false, 42, [], {}, 'x'.repeat(1025), '🙂'.repeat(513)] ) {
      const input = {serviceRef: ref, description};
      if ( description === undefined ) { delete input.description; }
      assert.equal((await f.engine.execute('update_service_description', input)).code, 'INVALID_INPUT');
    }
    assert.equal((await f.engine.execute('update_service_description', {serviceRef: ref, description: 'x', expectedDescription: 'guess'})).code, 'INVALID_INPUT');
    assert.equal(f.requests.filter((request) => request.method === 'POST').length, 0);
    for ( const description of ['', 'x'.repeat(1024), '🙂'.repeat(512)] ) {
      const result = await f.engine.execute('update_service_description', {serviceRef: ref, description});
      assert.equal(result.status, 'succeeded'); assert.equal(result.description, description);
    }
  });

  await test('description update uses only the CAS fields and verifies exact Unicode before success', async () => {
    const f = fixture(), ref = await serviceRef(f), description = '  繁體中文🙂\nSECRET_DESCRIPTION_SENTINEL  ';
    const result = await f.engine.execute('update_service_description', {serviceRef: ref, description});
    assert.equal(result.status, 'succeeded'); assert.equal(result.saved, true); assert.equal(result.verifiedResult, true);
    assert.equal(result.description, description); assert.equal(result.resourceTextIsUntrusted, true);
    const write = f.requests.find((request) => request.method === 'POST');
    assert.deepEqual(write.data, {serviceId: 'svc-a', description, expectedDescription: 'Original description'});
    assert.equal(write.url, 'projects/project-one/aiServiceDescriptionUpdates');
    assert.equal(f.requests.at(-1).url, 'projects/project-one/services/svc-a');
    assert.equal(f.requests.at(-1).method, 'GET');
    assert.equal(JSON.stringify(f.audits).includes('SECRET_DESCRIPTION_SENTINEL'), false);
    assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).description, description);
    const cleared = await f.engine.execute('update_service_description', {serviceRef: ref, description: ''});
    assert.equal(cleared.status, 'succeeded');
    assert.equal(f.requests.filter((request) => request.method === 'POST').at(-1).data.expectedDescription, description);
  });

  await test('description snapshots distinguish null, empty and unloaded collection values', async () => {
    const f = fixture(); f.setDescription(null);
    const ref = await serviceRef(f);
    assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).description, null);
    assert.equal((await f.engine.execute('update_service_description', {serviceRef: ref, description: ''})).status, 'succeeded');
    assert.equal(f.requests.filter((request) => request.method === 'POST').at(-1).data.expectedDescription, null);
    assert.equal((await f.engine.execute('update_service_description', {serviceRef: ref, description: 'next'})).status, 'succeeded');
    assert.equal(f.requests.filter((request) => request.method === 'POST').at(-1).data.expectedDescription, '');
    const missing = fixture(), request = missing.engine.request;
    missing.engine.request = async (options) => {
      const response = await request(options);
      if ( options.url.includes('/services?') ) { response.body.data.forEach((item) => delete item.description); }
      return response;
    };
    const unknownRef = await serviceRef(missing);
    assert.equal((await missing.engine.execute('update_service_description', {serviceRef: unknownRef, description: 'new'})).code, 'STALE_REFERENCE');
    assert.equal(missing.requests.filter((item) => item.method === 'POST').length, 0);
    assert.equal((await missing.engine.execute('get_service', {serviceRef: unknownRef})).description, 'Original description');
    assert.equal((await missing.engine.execute('update_service_description', {serviceRef: unknownRef, description: 'new'})).status, 'succeeded');
  });

  await test('description changed since discovery is rejected without silently refreshing the snapshot', async () => {
    const f = fixture(), ref = await serviceRef(f);
    f.setDescription('Human changed it');
    assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).code, 'CONFLICT');
    assert.equal((await f.engine.execute('update_service_description', {serviceRef: ref, description: 'overwrite'})).code, 'CONFLICT');
    assert.equal(f.requests.filter((request) => request.method === 'POST').length, 0);
    const freshRef = await serviceRef(f);
    assert.equal((await f.engine.execute('update_service_description', {serviceRef: freshRef, description: 'reviewed update'})).status, 'succeeded');
    assert.equal(f.requests.find((request) => request.method === 'POST').data.expectedDescription, 'Human changed it');
  });

  await test('description atomic conflicts and forbidden responses are definitive and never retried', async () => {
    for ( const status of [409, 403] ) {
      const f = fixture(), ref = await serviceRef(f), request = f.engine.request;
      f.engine.request = async (options) => {
        if ( options.method === 'POST' ) {
          f.requests.push(options);
          throw {status, body: {code: status === 409 ? 'DescriptionConflict' : 'PermissionDenied', message: 'SECRET_SENTINEL'}};
        }
        return request(options);
      };
      const result = await f.engine.execute('update_service_description', {serviceRef: ref, description: 'changed'});
      assert.equal(result.status, 'rejected'); assert.equal(result.code, status === 409 ? 'CONFLICT' : 'FORBIDDEN');
      assert.equal(f.requests.filter((options) => options.method === 'POST').length, 1);
      assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false);
    }
  });

  await test('description context changes block pre-submit work and mark submitted writes unknown', async () => {
    for ( const phase of ['read', 'write'] ) {
      const f = fixture(), ref = await serviceRef(f), entered = deferred(), barrier = deferred(), request = f.engine.request;
      f.engine.request = async (options) => {
        const response = await request(options);
        if ( phase === 'read' && options.url.endsWith('/services/svc-a') || phase === 'write' && options.method === 'POST' ) {
          entered.resolve(); await barrier.promise;
        }
        return response;
      };
      const pending = f.engine.execute('update_service_description', {serviceRef: ref, description: 'changed'});
      await entered.promise; f.snapshot.generation = 'replacement-session'; barrier.resolve();
      const result = await pending;
      assert.equal(result.code, phase === 'read' ? 'CONTEXT_CHANGED' : 'UNKNOWN_RESULT');
      assert.equal(f.requests.filter((options) => options.method === 'POST').length, phase === 'read' ? 0 : 1);
      assert.equal(result.description, undefined);
    }
  });

  await test('description lost response or mismatched readback is unknown and does not replay the write', async () => {
    for ( const outcome of ['lost', 'readback'] ) {
      const f = fixture(), ref = await serviceRef(f), request = f.engine.request;
      f.engine.request = async (options) => {
        const response = await request(options);
        if ( options.method === 'POST' ) {
          if ( outcome === 'lost' ) { throw new TypeError('Connection lost after save'); }
          f.setDescription('Another write won after save');
        }
        return response;
      };
      const result = await f.engine.execute('update_service_description', {serviceRef: ref, description: 'changed'});
      assert.equal(result.status, 'unknown'); assert.equal(result.code, 'UNKNOWN_RESULT');
      assert.equal(f.requests.filter((options) => options.method === 'POST').length, 1);
      assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).code, 'CONFLICT', 'unverified writes do not advance the old snapshot');
    }
  });

  await test('description audit admission failure blocks writes and result failure suppresses success', async () => {
    for ( const phase of ['start', 'result'] ) {
      const f = fixture(), ref = await serviceRef(f), audit = f.engine.audit;
      f.engine.audit = async (event, captured) => {
        if ( event.command === 'update_service_description' && event.phase === phase ) { throw new Error('Audit unavailable'); }
        return audit(event, captured);
      };
      const result = await f.engine.execute('update_service_description', {serviceRef: ref, description: 'SECRET_DESCRIPTION_SENTINEL'});
      assert.equal(result.code, phase === 'start' ? 'UNAVAILABLE' : 'UNKNOWN_RESULT');
      assert.equal(f.requests.filter((options) => options.method === 'POST').length, phase === 'start' ? 0 : 1);
      assert.equal(JSON.stringify(f.audits).includes('SECRET_DESCRIPTION_SENTINEL'), false);
    }
  });

  await test('pagination cursor is opaque, bound to query, and rejects off-scope next URLs', async () => {
    const f = fixture();
    f.engine.request = async (request) => {
      f.requests.push(request);
      return {body: {data: [{id: 'stack-a', name: 'Alpha'}], pagination: {next: 'https://localhost/v2-beta/projects/project-one/stacks?marker=2'}}};
    };
    const result = await f.engine.execute('find_stacks', {query: 'Al'});
    assert.equal(result.complete, false); assert.ok(result.nextCursor.startsWith('cursor_'));
    assert.equal((await f.engine.execute('find_stacks', {query: 'Different', cursor: result.nextCursor})).code, 'INVALID_INPUT');
    await f.engine.execute('find_stacks', {query: 'Al', cursor: result.nextCursor});
    assert.equal(f.requests[1].url, 'projects/project-one/stacks?marker=2');
    f.engine.request = async () => ({body: {data: [], pagination: {next: 'https://evil.invalid/private'}}});
    assert.equal((await f.engine.execute('find_stacks', {})).code, 'INVALID_RESPONSE');
  });

  await test('service capability reads the StoreTweaks actionLinks contract and retains actions fallback', async () => {
    const f = fixture(), ref = await serviceRef(f), request = f.engine.request;
    f.engine.request = async (options) => {
      const response = await request(options);
      if ( options.url.endsWith('/services/svc-a') ) {
        response.body.actionLinks = response.body.actions;
        delete response.body.actions;
      }
      return response;
    };
    assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).availableActions.previewUpgrade, true);
    f.engine.request = request;
    assert.equal((await f.engine.execute('get_service', {serviceRef: ref})).availableActions.previewUpgrade, true);
  });

  await test('preview has no apply side effect; server confirmation gates image-only apply', async () => {
    const f = fixture(), result = await preview(f);
    assert.equal(result.status, 'needs_user'); assert.equal(f.plans.length, 1);
    assert.equal(f.requests.filter((request) => request.url.includes('action=apply')).length, 0);
    const creation = f.requests.find((request) => request.url.endsWith('aiServiceUpgradePlans'));
    assert.deepEqual(creation.data, {serviceId: 'svc-a', image: 'example/web:2'});
    assert.equal((await f.engine.execute('apply_service_upgrade', {planRef: result.planRef})).code, 'CONFLICT');
    assert.equal((await f.engine.confirmPlan(result.planRef)).confirmationState, 'approved');
    const applied = await f.engine.execute('apply_service_upgrade', {planRef: result.planRef});
    assert.equal(applied.status, 'accepted'); assert.equal(applied.verifiedResult, false);
    assert.deepEqual(f.requests.at(-1).data, {});
    for ( const [state, verified, expected] of [['running', false, 'running'], ['unknown', false, 'unknown'], ['succeeded', false, 'unknown'], ['succeeded', true, 'succeeded'], ['failed', false, 'failed']] ) {
      f.setStatus(state, verified);
      assert.equal((await f.engine.execute('get_operation', {operationRef: applied.operationRef})).status, expected);
    }
  });

  await test('plan summary preserves the authoritative disambiguating display path', async () => {
    const f = fixture();
    const summary = f.engine.planSummary({id: 'plan-a', serviceName: 'web', displayPath: 'Environment/Alpha/web'}, 'opaque-plan');
    assert.equal(summary.displayPath, 'Environment/Alpha/web');
    assert.equal(f.engine.planSummary({id: 'fixture-plan', serviceName: 'web'}, 'fixture-ref').displayPath, 'web');
    assert.equal(f.engine.planSummary({id: 'plan-long', displayPath: 'x'.repeat(900)}, 'opaque-plan').displayPath.length, 768);
  });

  await test('late confirmation updates only the matching pending plan', async () => {
    const source = fs.readFileSync(path.resolve(root, '../services/ai-command-service.js'), 'utf8')
      .replace("import Service, { service } from '@ember/service';", 'const Service = {extend: (value) => value}; const service = () => null;')
      .replace("'ui/utils/ai-command-engine'", `'${moduleUrl('ai-command-engine')}'`)
      .replace("'ui/utils/ai-command-contract'", `'${moduleUrl('ai-command-contract')}'`);
    const {default: definition} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for ( const scenario of ['newer-plan', 'dismissed', 'matching-plan'] ) {
      const f = fixture(), entered = deferred(), response = deferred();
      const service = Object.assign({}, definition, {pendingPlan: null, engine: f.engine,
        get(key) { return key.split('.').reduce((value, part) => value && value[part], this); },
        set(key, value) { this[key] = value; }});
      f.engine.onPlan = (plan, expectedPlanRef) => service.publishPlan(plan, expectedPlanRef);
      const planA = await preview(f);
      const request = f.engine.request;
      f.engine.request = async (options) => {
        const result = await request(options);
        if ( options.url.endsWith('?action=confirm') ) { entered.resolve(); await response.promise; }
        return result;
      };
      const confirmingA = service.confirmPendingPlan();
      await entered.promise;
      let expectedRef = planA.planRef;
      if ( scenario === 'newer-plan' ) {
        const planB = await f.engine.execute('preview_service_upgrade', {serviceRef: await serviceRef(f), image: 'example/web:3'});
        expectedRef = planB.planRef;
      } else if ( scenario === 'dismissed' ) {
        service.dismissPendingPlan(); expectedRef = null;
      }
      response.resolve();
      const confirmed = await confirmingA;
      assert.equal(confirmed.confirmationState, 'approved');
      assert.equal(service.pendingPlan && service.pendingPlan.planRef, expectedRef, scenario);
      if ( scenario === 'matching-plan' ) { assert.equal(service.pendingPlan.confirmationState, 'approved'); }
    }
  });

  await test('terminal operation clears only its current pending plan and retains query references', async () => {
    const source = fs.readFileSync(path.resolve(root, '../services/ai-command-service.js'), 'utf8')
      .replace("import Service, { service } from '@ember/service';", 'const Service = {extend: (value) => value}; const service = () => null;')
      .replace("'ui/utils/ai-command-engine'", `'${moduleUrl('ai-command-engine')}'`)
      .replace("'ui/utils/ai-command-contract'", `'${moduleUrl('ai-command-contract')}'`);
    const {default: definition} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const f = fixture(), plan = await preview(f);
    const service = Object.assign({}, definition, {pendingPlan: f.plans.at(-1), commandContext: {context: f.context},
      get(key) { return this[key]; }, set(key, value) { this[key] = value; }});
    f.engine.onOperation = (operation) => service.clearCompletedPlan(operation);
    await f.engine.confirmPlan(plan.planRef);
    const applied = await f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    for ( const [status, verified] of [['accepted', false], ['running', false], ['unknown', false], ['succeeded', false]] ) {
      f.setStatus(status, verified);
      await f.engine.execute('get_operation', {operationRef: applied.operationRef});
      assert.equal(service.pendingPlan.planRef, plan.planRef);
    }
    f.setStatus('succeeded', true);
    await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(service.pendingPlan, null);
    assert.equal((await f.engine.execute('get_operation', {operationRef: applied.operationRef})).status, 'succeeded');
    const captured = f.context.capture(), newerRef = f.context.reference('plan', {id: 'newer-plan'}, captured);
    service.pendingPlan = {planRef: newerRef, context: captured};
    f.setStatus('failed', false);
    await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(service.pendingPlan.planRef, newerRef, 'old terminal completion preserves the newer preview');
    service.pendingPlan = f.plans.at(-1);
    await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(service.pendingPlan, null, 'failed terminal clears its matching plan');
  });

  await test('review bridge closes only its own visible modal after the pending plan clears', async () => {
    const source = fs.readFileSync(path.resolve(root, '../components/ai-upgrade-review/component.js'), 'utf8')
      .replace("import Component from '@ember/component';", 'const Component = {extend: (value) => value};')
      .replace("import { observer } from '@ember/object';", 'const observer = (key, callback) => callback;')
      .replace("import { scheduleOnce } from '@ember/runloop';", 'const scheduleOnce = () => {};')
      .replace("import { service } from '@ember/service';", 'const service = () => null;');
    const {default: definition} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for ( const [pendingPlan, modalType, modalVisible, expected] of [
      [null, 'modal-confirm-ai-upgrade', true, 1], [null, 'another-modal', true, 0],
      [null, 'modal-confirm-ai-upgrade', false, 0], [{planRef: 'newer-plan'}, 'modal-confirm-ai-upgrade', true, 0],
    ] ) {
      let calls = 0;
      const bridge = Object.assign({}, definition, {commands: {pendingPlan}, modalService: {modalType, modalVisible,
        toggleModal() { calls++; this.modalVisible = false; }},
        get(key) { return key.split('.').reduce((object, part) => object && object[part], this); }});
      bridge.openReview();
      assert.equal(calls, expected);
    }
  });

  await test('auth, account, environment, schema and route changes invalidate old refs', async () => {
    for ( const field of ['generation', 'accountId', 'projectId', 'schemaProjectId', 'schemaGeneration', 'route'] ) {
      const f = fixture(), ref = await serviceRef(f), before = f.requests.length;
      f.snapshot[field] = `${f.snapshot[field]}-changed`;
      const result = await f.engine.execute('get_service', {serviceRef: ref});
      assert.ok(['STALE_REFERENCE', 'UNAVAILABLE'].includes(result.code), `${field}: ${result.code}`);
      assert.equal(f.requests.length, before);
    }
  });

  await test('lost apply response preserves the existing operation reference and recovers without resubmission', async () => {
    const f = fixture(), plan = await preview(f), accepted = deferred(), response = deferred();
    await f.engine.confirmPlan(plan.planRef);
    const request = f.engine.request;
    f.engine.request = async (options) => {
      const result = await request(options);
      if ( options.url.endsWith('?action=apply') ) { accepted.resolve(); await response.promise; }
      return result;
    };
    const pending = f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    await accepted.promise;
    const reservedRef = Array.from(f.context.references.keys()).find((key) => key.startsWith('operation_'));
    assert.ok(reservedRef, 'operation ref exists before the POST response');
    response.reject(new Error('connection lost after durable acceptance'));
    const unknown = await pending;
    assert.equal(unknown.status, 'unknown'); assert.equal(unknown.operationRef, reservedRef);
    f.setStatus('succeeded', true);
    const recovered = await f.engine.execute('get_operation', {operationRef: unknown.operationRef});
    assert.equal(recovered.status, 'succeeded'); assert.equal(recovered.operationRef, reservedRef);
    assert.equal(f.requests.filter((item) => item.url.endsWith('?action=apply')).length, 1);
    assert.equal(f.requests.at(-1).url, 'projects/project-one/aiServiceUpgradePlans/server-plan');
    assert.equal(f.requests.at(-1).method, 'GET');
  });

  await test('context change after apply submission reports unknown without re-authorizing the old ref', async () => {
    const f = fixture(), plan = await preview(f), accepted = deferred(), response = deferred();
    await f.engine.confirmPlan(plan.planRef);
    const request = f.engine.request;
    f.engine.request = async (options) => {
      const result = await request(options);
      if ( options.url.endsWith('?action=apply') ) { accepted.resolve(); await response.promise; }
      return result;
    };
    const pending = f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    await accepted.promise;
    const reservedRef = Array.from(f.context.references.keys()).find((key) => key.startsWith('operation_'));
    f.snapshot.generation = 'new-authorized-session'; response.resolve();
    const unknown = await pending;
    assert.equal(unknown.status, 'unknown'); assert.equal(unknown.code, 'UNKNOWN_RESULT');
    assert.equal(unknown.operationRef, undefined);
    assert.match(unknown.nextStep, /authorized session/);
    assert.equal((await f.engine.execute('get_operation', {operationRef: reservedRef})).code, 'STALE_REFERENCE');
    assert.equal(f.requests.filter((item) => item.url.endsWith('?action=apply')).length, 1);
  });

  await test('operation polling is bounded and exits early on verified terminal state', async () => {
    const f = fixture(), plan = await preview(f);
    await f.engine.confirmPlan(plan.planRef);
    const applied = await f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    let waits = 0;
    f.engine.wait = async (milliseconds) => { assert.equal(milliseconds, 750); waits++; };
    f.setStatus('running', false);
    const before = f.requests.length;
    const running = await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(f.requests.length - before, 10); assert.equal(waits, 9);
    assert.equal(running.status, 'running'); assert.equal(running.retryAfterMs, 750);
    assert.match(running.nextStep, /same operationRef/);
    waits = 0;
    f.engine.wait = async () => { waits++; if ( waits === 2 ) { f.setStatus('succeeded', true); } };
    const earlyBefore = f.requests.length;
    const completed = await f.engine.execute('get_operation', {operationRef: applied.operationRef});
    assert.equal(completed.status, 'succeeded'); assert.equal(f.requests.length - earlyBefore, 3);
    assert.equal(waits, 2);
    assert.equal(f.requests.filter((item) => item.url.endsWith('?action=apply')).length, 1);
  });

  await test('operation polling abort or context change during wait prevents the next request', async () => {
    for ( const reason of ['abort', 'context'] ) {
      const f = fixture(), plan = await preview(f);
      await f.engine.confirmPlan(plan.planRef);
      const applied = await f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
      const controller = new AbortController(); let waits = 0;
      f.engine.wait = async () => {
        waits++;
        if ( reason === 'abort' ) { controller.abort(); } else { f.snapshot.generation = 'replacement-session'; }
      };
      const before = f.requests.length;
      const result = await f.engine.execute('get_operation', {operationRef: applied.operationRef}, {signal: controller.signal});
      assert.equal(result.code, reason === 'abort' ? 'CANCELLED' : 'CONTEXT_CHANGED');
      assert.equal(waits, 1); assert.equal(f.requests.length - before, 1);
    }
  });

  await test('default polling wait cleans its abort listener and timer on both outcomes without sleeping', async () => {
    const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
    try {
      for ( const outcome of ['timeout', 'abort'] ) {
        let callback, listener, removed = 0, cleared = 0;
        globalThis.setTimeout = (fn, milliseconds) => { assert.equal(milliseconds, 750); callback = fn; return 123; };
        globalThis.clearTimeout = (id) => { assert.equal(id, 123); cleared++; };
        const signal = {aborted: false, addEventListener(name, fn) { listener = fn; }, removeEventListener(name, fn) { assert.equal(fn, listener); removed++; }};
        const pending = waitForOperationPoll(750, signal);
        if ( outcome === 'timeout' ) { callback(); await pending; } else { listener(); await assert.rejects(pending, /CANCELLED/); }
        assert.equal(removed, 1); assert.equal(cleared, 1);
      }
    } finally { globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; }
  });

  await test('context change while auth awaits prevents request submission', async () => {
    const f = fixture(), barrier = deferred();
    f.engine.ensureSession = () => barrier.promise;
    const pending = f.engine.execute('find_stacks', {});
    f.snapshot.generation = 'new-session'; barrier.resolve();
    assert.equal((await pending).code, 'CONTEXT_CHANGED'); assert.equal(f.requests.length, 0);
  });

  await test('late preview response cannot publish into a new environment', async () => {
    const f = fixture(), ref = await serviceRef(f), barrier = deferred(), entered = deferred();
    f.engine.request = async () => { entered.resolve(); return barrier.promise; };
    const pending = f.engine.execute('preview_service_upgrade', {serviceRef: ref, image: 'example/web:2'});
    await entered.promise; f.snapshot.route = '/other';
    barrier.resolve({body: {id: 'late-plan', serviceName: 'web'}});
    assert.equal((await pending).code, 'CONTEXT_CHANGED'); assert.equal(f.plans.length, 0);
  });

  await test('read-only mode registers only reads and rejects direct mutation invocation', async () => {
    const f = fixture(), registered = [];
    f.context.setMode('read-only');
    const registration = registerCommandTools({context: f.context, engine: f.engine,
      modelContext: {registerTool(tool) { registered.push(tool); }}});
    await registration.ready;
    assert.deepEqual(registered.map((tool) => tool.name), ['find_stacks', 'find_services', 'get_service', 'get_operation']);
    assert.equal((await f.engine.execute('apply_service_upgrade', {planRef: 'guessed'})).code, 'UNAVAILABLE');
    registration.dispose(); registration.dispose();
  });

  await test('native registration and execution cancellation are independent; old callbacks expire', async () => {
    const f = fixture(), registered = [];
    const registration = registerCommandTools({context: f.context, engine: f.engine,
      modelContext: {registerTool(tool, options) { registered.push({tool, signal: options.signal}); }}});
    await registration.ready;
    const execution = new AbortController(); registration.dispose();
    assert.equal(registered[0].signal.aborted, true); assert.equal(execution.signal.aborted, false);
    f.context.setMode('off'); f.context.setMode('enabled');
    const result = await registered[0].tool.execute({}, {signal: execution.signal});
    assert.equal(JSON.parse(result.content[0].text).code, 'UNAVAILABLE');
    assert.equal(f.requests.length, 0);
  });

  await test('partial registration rolls back; 100 activate/dispose cycles retain no handlers', async () => {
    const f = fixture(); let active = 0;
    const modelContext = {registerTool(tool, {signal}) { active++; signal.addEventListener('abort', () => active--, {once: true}); }};
    for ( let i = 0; i < 100; i++ ) {
      const registration = registerCommandTools({context: f.context, engine: f.engine, modelContext});
      await registration.ready;
      assert.equal(active, COMMANDS.length); registration.dispose(); registration.dispose(); assert.equal(active, 0);
    }
    let calls = 0;
    const failed = registerCommandTools({context: f.context, engine: f.engine,
      modelContext: {registerTool(tool, options) { if ( ++calls === 3 ) { throw new Error('fixture failure'); } modelContext.registerTool(tool, options); }}});
    await assert.rejects(failed.ready);
    assert.equal(active, 0);
  });

  await test('asynchronous registration rejection rolls back all published tools', async () => {
    const f = fixture(), barrier = deferred(); let active = 0, calls = 0, firstTool;
    const registration = registerCommandTools({context: f.context, engine: f.engine,
      modelContext: {registerTool(tool, {signal}) {
        firstTool = firstTool || tool;
        active++; calls++; signal.addEventListener('abort', () => active--, {once: true});
        return calls === 2 ? barrier.promise : Promise.resolve();
      }}});
    const failed = assert.rejects(registration.ready, /async fixture/);
    await Promise.resolve();
    assert.equal(calls, 2); assert.equal(active, 2);
    assert.equal(JSON.parse((await firstTool.execute({})).content[0].text).code, 'UNAVAILABLE');
    assert.equal(f.requests.length, 0);
    barrier.reject(new Error('async fixture')); await failed;
    assert.equal(active, 0); assert.equal(calls, 2);
  });

  await test('dispose or context change during awaited registration prevents later tools', async () => {
    for ( const reason of ['dispose', 'context'] ) {
      const f = fixture(), barrier = deferred(); let calls = 0, signal;
      const registration = registerCommandTools({context: f.context, engine: f.engine,
        modelContext: {registerTool(tool, options) { calls++; signal = options.signal; return barrier.promise; }}});
      const cancelled = assert.rejects(registration.ready);
      if ( reason === 'dispose' ) { registration.dispose(); } else { f.snapshot.generation = 'new-session'; }
      barrier.resolve(); await cancelled;
      assert.equal(calls, 1); assert.equal(signal.aborted, true);
    }
  });

  await test('registry async failure and late completion cannot disable a newer registration', async () => {
    // Import the actual Ember wrapper with a minimal Service declaration stub;
    // its production refresh method and native feature gate run unchanged.
    const source = fs.readFileSync(path.resolve(root, '../services/webmcp-registry.js'), 'utf8')
      .replace("import Service, { service } from '@ember/service';", 'const Service = {extend: (value) => value}; const service = () => null;')
      .replace("'ui/utils/webmcp-tools'", `'${moduleUrl('webmcp-tools')}'`);
    const {default: definition} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    try {
      for ( const outcome of ['resolve', 'reject'] ) {
        const f = fixture(), barrier = deferred(); let calls = 0, active = 0;
        globalThis.window = {isSecureContext: true, AbortController};
        globalThis.document = {modelContext: {registerTool(tool, {signal}) {
          calls++; active++; signal.addEventListener('abort', () => active--, {once: true});
          return calls === 1 ? barrier.promise : Promise.resolve();
        }}};
        const registry = Object.assign({}, definition, {
          commandContext: {context: f.context}, commands: {engine: f.engine, dismissPendingPlan() {}},
          get(key) { return this[key]; }, set(key, value) { this[key] = value; },
        });
        const first = registry.setMode('enabled');
        assert.equal(registry.status, 'registering'); assert.equal(active, 1);
        await registry.setMode('off');
        assert.equal(registry.status, 'disabled'); assert.equal(active, 0);
        await registry.setMode('enabled');
        assert.equal(registry.status, 'enabled'); assert.equal(active, COMMANDS.length);
        if ( outcome === 'resolve' ) { barrier.resolve(); } else { barrier.reject(new Error('late rejection')); }
        await first;
        assert.equal(registry.status, 'enabled'); assert.equal(active, COMMANDS.length);
        await registry.setMode('off'); assert.equal(active, 0);
      }
      const f = fixture();
      globalThis.document = {modelContext: {registerTool() { return Promise.reject(new Error('native rejected')); }}};
      const registry = Object.assign({}, definition, {
        commandContext: {context: f.context}, commands: {engine: f.engine, dismissPendingPlan() {}},
        get(key) { return this[key]; }, set(key, value) { this[key] = value; },
      });
      await registry.setMode('enabled');
      assert.equal(registry.status, 'unavailable'); assert.equal(f.context.mode, 'off');
    } finally { globalThis.window = previousWindow; globalThis.document = previousDocument; }
  });

  await test('untrusted transport errors never disclose body, cause or stack', async () => {
    const f = fixture(); f.engine.request = async () => { throw {status: 403, message: 'SECRET_SENTINEL', body: {token: 'SECRET_SENTINEL'}, cause: 'SECRET_SENTINEL'}; };
    const result = await f.engine.execute('find_stacks', {});
    assert.equal(result.code, 'FORBIDDEN'); assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false);
  });

  await test('rawRequest public 4xx errors offer bounded repair while lost network remains unknown', async () => {
    for ( const [status, serverCode, expected] of [
      [409, 'UpgradeNeedsConfirmation', 'NEEDS_USER'], [422, 'UpgradeInputInvalid', 'INVALID_INPUT'],
      [422, 'InvalidOption', 'INVALID_INPUT'], [409, 'UpgradePlanExpired', 'CONFLICT'],
      [409, 'UpgradePlanStale', 'CONFLICT'], [409, 'UpgradeCancelled', 'CONFLICT'],
      [403, 'UpgradeNeedsConfirmation', 'FORBIDDEN'], [500, 'UpgradeNeedsConfirmation', 'UNKNOWN_RESULT'],
      [405, 'Method not allowed', 'FORBIDDEN'],
    ] ) {
      const result = publicError({status, statusText: 'SECRET_SENTINEL', headers: {},
        body: {type: 'error', status, code: serverCode, message: 'SECRET_SENTINEL', detail: 'SECRET_SENTINEL'}});
      assert.equal(result.code, expected);
      assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false);
    }
    assert.equal(publicError(new TypeError('Failed to fetch')).code, 'UNKNOWN_RESULT');
    const f = fixture(), plan = await preview(f), request = f.engine.request;
    f.engine.request = async (options) => {
      if ( options.url.endsWith('?action=apply') ) {
        throw {status: 409, body: {type: 'error', code: 'UpgradeNeedsConfirmation', message: 'SECRET_SENTINEL'}};
      }
      return request(options);
    };
    const result = await f.engine.execute('apply_service_upgrade', {planRef: plan.planRef});
    assert.equal(result.status, 'needs_user'); assert.equal(result.code, 'NEEDS_USER');
    assert.equal(JSON.stringify(result).includes('SECRET_SENTINEL'), false);
  });

  assert.ok(count > 0, 'the requested test filter matched at least one case');
  if ( !filter ) {
    const registry = fs.readFileSync(path.resolve(root, '../services/webmcp-registry.js'), 'utf8');
    const initializer = fs.readFileSync(path.resolve(root, '../instance-initializers/webmcp.js'), 'utf8');
    assert.ok(registry.includes('window.isSecureContext') && registry.includes('document.modelContext'));
    assert.ok(!registry.includes('unregisterTool'));
    assert.ok(initializer.indexOf("config.APP.webmcpMode === 'enabled'") < initializer.indexOf("instance.lookup('service:webmcp-registry')"));
  }
  process.stdout.write(`PASS ${count} WebMCP production-core unit cases${filter ? ' (filtered)' : ' and initializer boundary checks'}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
