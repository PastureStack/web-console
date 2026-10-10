import EmberObject from '@ember/object';
import { resolve, reject } from 'rsvp';
import { module, test } from 'qunit';
import AuditLogsController from 'ui/admin-tab/audit-logs/controller';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Controller | admin tab | audit logs export transport');

test('real export transport sends same-origin GET with CSRF and releases its timeout on success and rejection', async function(assert) {
  let originalFetch = window.fetch;
  let originalTimeout = window.setTimeout;
  let originalClear = window.clearTimeout;
  let pending = new Map();
  let cleared = 0;
  let calls = [];
  let fail = false;
  let controller = createOwned(AuditLogsController, {
    intl: EmberObject.create({_locale: ['zh-tw'], t(key) { return key; }}),
    userStore: EmberObject.create({headers: {'X-Api-Csrf': 'synthetic-csrf', 'X-Api-No-Challenge': 'true'}}),
  }, 'controller');
  window.setTimeout = (callback, milliseconds, ...args) => {
    if (milliseconds !== 30000) { return originalTimeout(callback, milliseconds, ...args); }
    let id = Symbol('audit-export-timeout');
    pending.set(id, callback);
    return id;
  };
  window.clearTimeout = (id) => {
    if (!pending.has(id)) { return originalClear(id); }
    pending.delete(id);
    cleared++;
  };
  window.fetch = (url, options) => {
    calls.push({url, options});
    return fail ? reject(new TypeError('synthetic network failure')) :
      resolve(new Response('[]', {status: 200, headers: {'Content-Type': 'application/json'}}));
  };
  try {
    let url = '/v2-beta/pasturestack/audit-logs/export?format=json&timeScope=all';
    let blob = await controller.fetchAuditExport(url, 'json');
    assert.strictEqual(await blob.text(), '[]');
    assert.strictEqual(calls[0].url, url);
    let options = calls[0].options;
    assert.strictEqual(options.method, 'GET');
    assert.strictEqual(options.credentials, 'same-origin');
    assert.strictEqual(options.redirect, 'error');
    assert.strictEqual(options.headers['X-Api-Csrf'], 'synthetic-csrf');
    assert.strictEqual(options.headers['X-Api-No-Challenge'], 'true');
    assert.strictEqual(options.headers['Accept-Language'], 'zh-tw');
    assert.strictEqual(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    assert.strictEqual(pending.size, 0, 'successful transport cancels the owned timeout');
    fail = true;
    await assert.rejects(controller.fetchAuditExport(url, 'json'), TypeError);
    assert.strictEqual(pending.size, 0, 'rejected transport cancels the owned timeout');
    assert.strictEqual(cleared, 2, 'each owned request cleans exactly its own timeout');
    assert.strictEqual(calls.length, 2, 'no automatic retry or DELETE is performed');
  } finally {
    window.fetch = originalFetch;
    window.setTimeout = originalTimeout;
    window.clearTimeout = originalClear;
    destroyOwned(controller);
  }
});
