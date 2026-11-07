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
        if (rows.length) plan.configurationChanges = rows;
        plan = mutate(plan);
        if (pause) await pause();
        return {body: structuredClone(plan)};
      }
      if (request.url.endsWith('?action=confirm')) { plan.confirmationState = 'approved'; return {body: structuredClone(plan)}; }
      if (request.url.endsWith('?action=apply')) { writes++; return {body: {...structuredClone(plan), status: 'accepted', verifiedResult: false}}; }
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
  const template = readFileSync(new URL('../app/components/modal-confirm-ai-upgrade/template.hbs', import.meta.url), 'utf8');
  assert.match(template, /reviewLabels.upgradeConfigurationChanges/); assert.match(template, /<pre[^>]*>{{change.before}}<\/pre>/);
  assert.match(template, /<pre[^>]*>{{change.after}}<\/pre>/); assert.doesNotMatch(template, /{{{change\.(before|after)}}}/);
});
