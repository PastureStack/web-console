import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CommandContext, CommandEngine, COMMANDS} from '../bridge/shared-modules.mjs';

const strategy = {startFirst: false, batchSize: 1, intervalMillis: 2000};
const id = 'aiplan-11111111-1111-1111-1111-111111111111';
function fixture({transportKind = 'browser', mutate = x => x, pause, rejectPreview} = {}) {
  const snapshot = {generation: 'g', accountId: 'actor', projectId: 'p1', schemaProjectId: 'p1', schemaGeneration: 1, route: '/stacks'};
  let seq = 0, plan, writes = 0;
  const context = new CommandContext(() => snapshot, () => String(++seq)); context.setMode('enabled');
  const calls = [], review = [];
  const engine = new CommandEngine({context, transportKind, ensureSession: async () => {}, onPlan: x => review.push(x),
    audit: async () => ({accepted: true, requestId: 'audit'}), request: async request => {
      calls.push(request);
      if (request.method === 'POST' && request.url === 'projects/p1/aiServiceUpgradePlans') {
        if (rejectPreview) throw rejectPreview;
        const data = request.data;
        plan = {id, serviceId: 's1', serviceName: 'web', displayPath: 'Env/Stack/web', currentImage: 'docker:app:1',
          requestedImage: data.image ? 'docker:' + data.image : 'docker:app:1', upgradeStrategy: strategy, status: 'preview', confirmationState: 'pending'};
        const rows = [];
        if (Object.hasOwn(data, 'ports')) rows.push({field: 'ports', before: '["8080:80/tcp"]', after: JSON.stringify(data.ports)});
        if (Object.hasOwn(data, 'healthCheck')) rows.push({field: 'healthCheck', before: null,
          after: data.healthCheck === null ? null : JSON.stringify({strategy: 'recreate', ...data.healthCheck})});
        for (const field of ['command', 'entryPoint']) if (Object.hasOwn(data, field)) rows.push({field,
          before: '["old"]', after: data[field] === null ? null : JSON.stringify(data[field])});
        if (rows.length) plan.configurationChanges = rows;
        plan = mutate(plan);
        if (pause) await pause();
        return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: structuredClone(plan)}; }
      if (request.url.endsWith('?action=apply')) {
        if (plan.confirmationState !== 'approved') throw {status: 409, body: {code: 'UpgradeNeedsConfirmation'}};
        writes++; return {body: {...structuredClone(plan), status: 'accepted', verifiedResult: false}};
      }
      if (request.url.endsWith('/' + id)) return {body: structuredClone(plan)};
      throw Error('Unexpected fixed route');
    }});
  const ref = context.reference('service', {id: 's1'}, context.capture());
  return {engine, context, calls, ref, review, get plan() { return plan; }, get writes() { return writes; }};
}
for (const transportKind of ['browser', 'stdio']) {
  test(`${transportKind} config-only preserves image and exact approved typed delta with no direct Service PUT`, async () => {
    const f = fixture({transportKind});
    const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, ports: ['9090:90/tcp'], healthCheck: {port: 90}});
    assert.equal(result.status, 'needs_user'); assert.equal(result.currentImage, result.requestedImage);
    assert.deepEqual(f.calls[0].data, {serviceId: 's1', ports: ['9090:90/tcp'], healthCheck: {port: 90}});
    assert.equal(f.review.length, 1); assert.equal(result.configurationChanges.length, 2); assert.equal(f.writes, 0);
    assert.equal(f.calls.some(x => x.method === 'PUT' || /\/services/.test(x.url)), false);
    f.plan.confirmationState = 'approved';
    const applied = await f.engine.execute('apply_service_upgrade', {planRef: result.planRef});
    assert.equal(applied.status, 'accepted'); assert.equal(f.writes, 1); assert.deepEqual(f.calls.at(-1).data, {});
  });
}
test('explicit same image with config reaches the server and clear/omit are exact', async () => {
  const f = fixture();
  const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, image: 'app:1', ports: [], healthCheck: null});
  assert.equal(result.status, 'needs_user'); assert.deepEqual(f.calls[0].data, {serviceId: 's1', image: 'app:1', ports: [], healthCheck: null});
  const omitted = fixture(); await omitted.engine.execute('preview_service_upgrade', {serviceRef: omitted.ref, ports: ['90/tcp']});
  assert.equal(Object.hasOwn(omitted.calls[0].data, 'image'), false); assert.equal(Object.hasOwn(omitted.calls[0].data, 'healthCheck'), false);
});

for (const transportKind of ['browser', 'stdio']) {
  test(`${transportKind} startup argument upgrade preserves exact arrays and needs the original human approval`, async () => {
    const f = fixture({transportKind}), command = ['serve', '  keep spacing  ', '', '繁體中文', '|'], entryPoint = ['/bin/app'];
    const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, command, entryPoint});
    assert.equal(result.status, 'needs_user'); assert.equal(result.currentImage, result.requestedImage);
    assert.deepEqual(f.calls[0].data, {serviceId: 's1', command, entryPoint}); assert.equal(f.writes, 0);
    assert.deepEqual(result.configurationChanges.map(row => [row.field, JSON.parse(row.after)]), [['command', command], ['entryPoint', entryPoint]]);
    command[0] = 'changed'; entryPoint[0] = 'changed';
    assert.equal(f.calls[0].data.command[0], 'serve'); assert.equal(f.calls[0].data.entryPoint[0], '/bin/app');
    const unapproved = await f.engine.execute('apply_service_upgrade', {planRef: result.planRef});
    assert.equal(unapproved.status, 'needs_user'); assert.equal(f.writes, 0);
    f.plan.confirmationState = 'approved';
    assert.equal((await f.engine.execute('apply_service_upgrade', {planRef: result.planRef})).status, 'accepted');
    assert.equal(f.writes, 1); assert.deepEqual(f.calls.at(-1).data, {});
    assert.equal(f.calls.some(call => call.method === 'PUT' || /\/services/.test(call.url)), false);
  });
}

test('startup argument upgrade keeps native null empty and omitted values distinct', async () => {
  const f = fixture(), result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, command: null, entryPoint: []});
  assert.equal(result.status, 'needs_user'); assert.deepEqual(f.calls[0].data, {serviceId: 's1', command: null, entryPoint: []});
  assert.deepEqual(result.configurationChanges.map(row => [row.field, row.after]), [['command', null], ['entryPoint', '[]']]);
  const omitted = fixture(); await omitted.engine.execute('preview_service_upgrade', {serviceRef: omitted.ref, ports: ['90/tcp']});
  assert.equal(Object.hasOwn(omitted.calls[0].data, 'command'), false); assert.equal(Object.hasOwn(omitted.calls[0].data, 'entryPoint'), false);
  const all = fixture(); assert.equal((await all.engine.execute('preview_service_upgrade',
    {serviceRef: all.ref, command: ['serve'], entryPoint: ['/app'], ports: [], healthCheck: null})).configurationChanges.length, 4);
});

test('startup argument upgrade rejects coercion excess limits forged reviews and confirmation drift', async () => {
  for (const value of ['serve --flag', {}, [1], [null], ['bad\0arg'], Array(65).fill(''), ['x'.repeat(4097)], Array(5).fill('x'.repeat(4096))]) {
    for (const field of ['command', 'entryPoint']) {
      const f = fixture(); assert.equal((await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, [field]: value})).code, 'INVALID_INPUT');
      assert.equal(f.calls.length, 0); assert.equal(f.writes, 0);
    }
  }
  for (const after of ['["changed"]', '"serve"', '[1]', '["bad\\u0000arg"]']) {
    const f = fixture({mutate: p => ({...p, configurationChanges: [{field: 'command', before: null, after}]})});
    assert.equal((await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, command: ['serve']})).code, 'INVALID_RESPONSE');
    assert.equal(f.review.length, 0); assert.equal(f.writes, 0);
  }
  const f = fixture(), preview = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, command: ['serve']});
  f.plan.configurationChanges[0].after = '["changed"]';
  assert.equal((await f.engine.confirmPlan(preview.planRef)).code, 'CONFLICT'); assert.equal(f.writes, 0);
  const max = fixture(); assert.equal((await max.engine.execute('preview_service_upgrade',
    {serviceRef: max.ref, command: Array(4).fill('\u0001'.repeat(4096))})).status, 'needs_user');
});
test('schema rejects missing intent raw LC unknown fields malformed config and readonly writes before transport', async () => {
  for (const extra of [{}, {launchConfig: {}}, {ports: null}, {ports: '80/tcp'}, {ports: [80]}, {healthCheck: {}},
    {healthCheck: {port: '80'}}, {healthCheck: {port: 80, headers: {}}}, {healthCheck: {port: 80, interval: 1.5}},
    {configurationChanges: []}, {serviceId: 's2', ports: []}]) {
    const f = fixture(); const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, ...extra});
    assert.equal(result.code, 'INVALID_INPUT', JSON.stringify(extra)); assert.equal(f.calls.length, 0); assert.equal(f.writes, 0);
  }
  assert.equal(COMMANDS.length, 12);
});
test('same shared image-only caller and review format remain valid', async () => {
  const f = fixture(); const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, image: 'app:2', startFirst: false});
  assert.equal(result.status, 'needs_user'); assert.equal(Object.hasOwn(result, 'configurationChanges'), false);
  assert.deepEqual(f.calls[0].data, {serviceId: 's1', image: 'app:2', startFirst: false});
});
test('caller config objects are detached before the awaited preview response', async () => {
  let release, entered; const start = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({pause: async () => { entered(); await gate; }}), ports = ['9090:90/tcp'], healthCheck = {port: 90};
  const pending = f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, ports, healthCheck});
  assert.equal(await Promise.race([start.then(() => true), pending.then(() => false)]), true, 'valid config preview must reach the plan owner');
  ports[0] = '9191:91/tcp'; healthCheck.port = 91; release();
  assert.equal((await pending).status, 'needs_user');
  assert.deepEqual(f.calls[0].data.ports, ['9090:90/tcp']); assert.deepEqual(f.calls[0].data.healthCheck, {port: 90});
});
test('health patches must preserve every omitted supported before field and strategy', async () => {
  const before = {port: 80, strategy: 'none', interval: 2000, responseTimeout: 3000};
  const f = fixture({mutate: p => ({...p, configurationChanges: [{field: 'healthCheck', before: JSON.stringify(before), after: JSON.stringify({...before, interval: 2500})}]})});
  const good = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, healthCheck: {interval: 2500}});
  assert.equal(good.status, 'needs_user'); assert.deepEqual(f.calls[0].data.healthCheck, {interval: 2500});
  for (const after of [{port: 80, strategy: 'recreate', interval: 2500}, {...before, interval: 2500, responseTimeout: 1}]) {
    const broken = fixture({mutate: p => ({...p, configurationChanges: [{field: 'healthCheck', before: JSON.stringify(before), after: JSON.stringify(after)}]})});
    assert.equal((await broken.engine.execute('preview_service_upgrade', {serviceRef: broken.ref, healthCheck: {interval: 2500}})).code, 'INVALID_RESPONSE');
  }
});
test('unsupported existing health config produces safe subset guidance and no Key escalation', async () => {
  const f = fixture({rejectPreview: {status: 409, body: {code: 'UpgradeConfigurationUnsupported', detail: 'PRIVATE_RAW'}}});
  const denied = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, healthCheck: {port: 90}});
  assert.equal(denied.code, 'UNAVAILABLE'); assert.match(denied.nextStep, /human console/); assert.match(denied.nextStep, /omit healthCheck/);
  assert.match(denied.nextStep, /Full Keys retain/); assert.doesNotMatch(JSON.stringify(denied), /PRIVATE_RAW/);
});
test('server review cannot drop add duplicate alter or forge any requested configuration field', async () => {
  for (const mutate of [
    p => {delete p.configurationChanges; return p;},
    p => ({...p, configurationChanges: []}),
    p => ({...p, configurationChanges: [...p.configurationChanges, ...p.configurationChanges]}),
    p => ({...p, configurationChanges: [{field: 'ports', before: '[]', after: '["91/tcp"]'}]}),
    p => ({...p, configurationChanges: [{field: 'environment', before: null, after: '{}'}]}),
    p => ({...p, configurationChanges: [{field: 'ports', before: 'secret', after: '["90/tcp"]'}]}),
    p => ({...p, requestedImage: 'docker:other:1'}),
    p => ({...p, upgradeStrategy: undefined}),
  ]) {
    const f = fixture({mutate}); const result = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, ports: ['90/tcp']});
    assert.equal(result.code, 'INVALID_RESPONSE'); assert.equal(f.review.length, 0); assert.equal(f.writes, 0);
  }
});
test('review drift cannot be reported as accepted and apply recovery never invents success', async () => {
  for (const action of ['confirm', 'apply']) {
    const f = fixture(), preview = await f.engine.execute('preview_service_upgrade', {serviceRef: f.ref, ports: ['90/tcp']});
    f.plan.configurationChanges[0].after = '["91/tcp"]'; f.plan.confirmationState = 'approved';
    const result = action === 'confirm' ? await f.engine.confirmPlan(preview.planRef) : await f.engine.execute('apply_service_upgrade', {planRef: preview.planRef});
    assert.equal(result.code, action === 'confirm' ? 'CONFLICT' : 'UNKNOWN_RESULT'); assert.equal(f.writes, action === 'confirm' ? 0 : 1);
    if (action === 'apply') { assert.ok(result.operationRef); assert.notEqual(result.verifiedResult, true); }
  }
});
test('human configuration review uses existing field translations and escaped before/after content', async () => {
  const src = readFileSync(new URL('../app/utils/ai-resource-review-labels.js', import.meta.url), 'utf8');
  const {resourceReviewLabels} = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const rows = [{field: 'ports', before: '["80/tcp"]', after: '["90/tcp"]'}, {field: 'healthCheck', before: null, after: '{"port":90,"strategy":"recreate"}'}];
  const result = resourceReviewLabels({configurationChanges: rows}, key => key);
  assert.equal(result.upgradeConfigurationChanges.length, 2); assert.equal(result.upgradeConfigurationChanges[0].fieldLabel, 'generic.ports');
  assert.match(result.upgradeConfigurationChanges[1].after, /90/);
  const startup = resourceReviewLabels({configurationChanges: [
    {field: 'command', before: '["<old>"]', after: '["serve","  exact  "]'},
    {field: 'entryPoint', before: null, after: '[]'}]}, key => key);
  assert.equal(startup.upgradeConfigurationChanges[0].fieldLabel, 'sidekickAddtlInfo.command');
  assert.equal(startup.upgradeConfigurationChanges[1].fieldLabel, 'sidekickAddtlInfo.entryPoint');
  assert.equal(startup.upgradeConfigurationChanges[0].after, '["serve","  exact  "]');
  const template = readFileSync(new URL('../app/components/modal-confirm-ai-upgrade/template.hbs', import.meta.url), 'utf8');
  assert.match(template, /reviewLabels.upgradeConfigurationChanges/); assert.match(template, /<pre[^>]*>{{change.before}}<\/pre>/);
  assert.match(template, /<pre[^>]*>{{change.after}}<\/pre>/); assert.doesNotMatch(template, /{{{change\.(before|after)}}}/);
});
