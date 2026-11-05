import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import YAML from 'yamljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');
const urls = new Map();
// The existing focused UI harness also loads real source with these Ember stubs.
function sourceUrl(filename) {
  filename = path.resolve(filename);
  if (urls.has(filename)) { return urls.get(filename); }
  const source = readFileSync(filename, 'utf8')
    .replace(/import \{ computed \} from '@ember\/object';/g, 'const computed = (...args) => args.at(-1);')
    .replace(/import \{ observer \} from '@ember\/object';/g, 'const observer = (...args) => args.at(-1);')
    .replace(/import \{ alias \} from '@ember\/object\/computed';/g, 'const alias = () => null;')
    .replace(/import \{ service \} from '@ember\/service';/g, 'const service = () => null;')
    .replace(/import ModalBase from 'lacsso\/components\/modal-base';/g, 'const ModalBase = {extend: value => value};')
    .replace(/from '(ui\/[^']+|\.\.?\/[^']+)'/g, (_whole, specifier) => {
      const resolved = specifier.startsWith('ui/') ? path.join(app, specifier.slice(3)) : path.resolve(path.dirname(filename), specifier);
      return `from '${sourceUrl(resolved.endsWith('.js') ? resolved : resolved + '.js')}'`;
    });
  const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  urls.set(filename, url);
  return url;
}

const labels = await import(sourceUrl(path.join(app, 'utils/ai-resource-review-labels.js')));
const {publicError, CommandError} = await import(sourceUrl(path.join(app, 'utils/ai-command-contract.js')));
const {default: definition} = await import(sourceUrl(path.join(app, 'components/modal-confirm-ai-upgrade/component.js')));
const locales = ['de-de','en-us','fa-ir','fil-ph','fr-fr','hu-hu','ja-jp','ko-kr','pt-br','ru-ru','uk-ua','zh-hans','zh-tw'];
const privateText = 'PRIVATE_CANARY body.message detail JWT secret';
function fixture(confirm) {
  const writes = [];
  const instance = {
    saving: false, approved: false, errors: null, submitDisabled: false,
    intl: {t: key => key}, commands: {confirmPendingPlan: confirm},
    get(key) { return key.split('.').reduce((row, part) => row && row[part], this); },
    set(key, value) { this[key] = value; writes.push([key, value]); },
    setProperties(values) { Object.assign(this, values); writes.push(values); },
  };
  return {instance, writes, confirm: () => definition.actions.confirm.call(instance)};
}

test('real 403 and 404 publicError confirmations show one safe permission explanation', async () => {
  for (const status of [403, 404]) {
    const result = publicError({status, body: {code: 'ApiKeyPolicyChanged', message: privateText, detail: privateText}});
    assert.equal(result.code, 'FORBIDDEN');
    const f = fixture(async () => result); const pending = f.confirm();
    assert.equal(f.instance.saving, true);
    await pending;
    assert.deepEqual(f.instance.errors, ['webmcp.forbidden']);
    assert.equal(f.instance.approved, false); assert.equal(f.instance.saving, false);
    assert.ok(!JSON.stringify(f.instance.errors).includes(privateText));
  }
});

test('conflict session and stale public codes ask for a fresh preview', async () => {
  const results = [publicError({status: 409, body: {code: 'ResourceChangePlanStale', message: privateText}}),
    publicError({status: 401, body: {message: privateText}}),
    publicError(new CommandError('STALE_REFERENCE')), publicError(new CommandError('CONTEXT_CHANGED'))];
  for (const result of results) {
    const f = fixture(async () => result); await f.confirm();
    assert.deepEqual(f.instance.errors, ['webmcp.stale']); assert.equal(f.instance.saving, false);
  }
  for (const code of ['CONFLICT', 'SESSION_REQUIRED', 'STALE_REFERENCE', 'STALE_REF', 'CONTEXT_CHANGED']) {
    assert.equal(labels.resourceConfirmationErrorKey(code), 'webmcp.stale');
  }
});

test('the pure mapping accepts only a public code and never raw errors or server text', async () => {
  assert.equal(labels.resourceConfirmationErrorKey('FORBIDDEN'), 'webmcp.forbidden');
  for (const value of [undefined, null, '', 'ApiKeyPolicyChanged', privateText, {code: 'FORBIDDEN', message: privateText},
    {get body() { throw new Error('Raw error body must not be read'); }}]) {
    assert.equal(labels.resourceConfirmationErrorKey(value), 'webmcp.failed');
  }
  for (const result of [publicError({status: 500, body: {code: privateText, message: privateText, detail: privateText}}),
    {status: 'unknown', code: 'UNKNOWN_RESULT', message: privateText, detail: privateText}]) {
    const f = fixture(async () => result); await f.confirm();
    assert.deepEqual(f.instance.errors, ['webmcp.failed']); assert.equal(f.instance.saving, false);
    assert.ok(!JSON.stringify(f.instance.errors).includes(privateText));
  }
});

test('success rejection and saving finally retain the existing confirmation lifecycle', async () => {
  const success = fixture(async () => ({status: 'succeeded', confirmationState: 'approved'}));
  await success.confirm(); assert.equal(success.instance.approved, true); assert.equal(success.instance.errors, null);
  assert.equal(success.instance.saving, false);
  const rejected = fixture(async () => { throw new Error(privateText); });
  await rejected.confirm(); assert.deepEqual(rejected.instance.errors, ['webmcp.failed']); assert.equal(rejected.instance.saving, false);
  let calls = 0; const disabled = fixture(async () => { calls++; }); disabled.instance.submitDisabled = true;
  assert.equal(disabled.confirm(), undefined); assert.equal(calls, 0); assert.equal(disabled.writes.length, 0);
  for (const field of ['isDestroyed', 'isDestroying']) {
    let resolve; const f = fixture(() => new Promise(done => { resolve = done; })); const pending = f.confirm();
    const before = f.writes.length; f.instance[field] = true; resolve({status: 'forbidden', code: 'FORBIDDEN'});
    await pending; assert.equal(f.writes.length, before);
  }
});

test('forbidden guidance is translated in all thirteen actual locale files with fixed safe keys', () => {
  // Match the actual translation-json-tree/environment parser for complete files.
  // Also parse each new entry strictly without rewriting unrelated legacy YAML.
  const english = YAML.parse(readFileSync(path.join(root, 'translations/en-us.yaml'), 'utf8')).webmcp.forbidden;
  const texts = [];
  for (const locale of locales) {
    const source = readFileSync(path.join(root, 'translations', locale + '.yaml'), 'utf8');
    const document = YAML.parse(source);
    const lines = source.split(/\r?\n/), start = lines.indexOf('webmcp:');
    const next = lines.findIndex((line, index) => index > start && line.length > 0 && !line.startsWith(' ') && !line.startsWith('#'));
    const entries = lines.slice(start + 1, next === -1 ? undefined : next).filter(line => line.startsWith('  forbidden:'));
    assert.equal(entries.length, 1, locale + ': one exact new key');
    assert.equal(yaml.load('webmcp:\n' + entries[0] + '\n').webmcp.forbidden, document.webmcp.forbidden, locale);
    for (const key of ['forbidden', 'stale', 'failed']) {
      assert.equal(typeof document.webmcp[key], 'string', locale + ': webmcp.' + key);
      assert.ok(document.webmcp[key].length > 10, locale + ': webmcp.' + key);
    }
    const text = document.webmcp.forbidden; texts.push(text);
    if (locale !== 'en-us') { assert.notEqual(text, english, locale); }
    assert.doesNotMatch(text, /<[^>]+>|JWT|secret|detail|message|\{\{|404|FORBIDDEN|ApiKeyPolicyChanged/i, locale);
  }
  assert.equal(new Set(texts).size, 13);
  const traditional = YAML.parse(readFileSync(path.join(root, 'translations/zh-tw.yaml'), 'utf8')).webmcp.forbidden;
  assert.match(traditional, /帳號或 API Key/); assert.match(traditional, /重新查詢/); assert.match(traditional, /預覽/); assert.match(traditional, /管理員/);
});

test('the original escaped alert renderer and other Catalog error paths stay unchanged', () => {
  const template = readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/template.hbs'), 'utf8');
  assert.match(template, /\{\{top-errors errors=this.errors\}\}/); assert.doesNotMatch(template, /\{\{\{|htmlSafe/);
  const source = readFileSync(path.join(app, 'components/modal-confirm-ai-upgrade/component.js'), 'utf8');
  assert.match(source, /resourceConfirmationErrorKey\(result.code, result.reason\)/);
  assert.doesNotMatch(source, /result\.(?:body|detail|message)|error\.(?:body|detail|message)/);
});


test('bridge profile setup needs-user guidance follows the real modal error lifecycle in thirteen languages', async () => {
  const result = publicError(new CommandError('NEEDS_USER', 'bridge.environmentBinding'));
  assert.equal(result.code, 'NEEDS_USER'); assert.equal(result.status, 'needs_user');
  assert.equal(result.reason, 'BRIDGE_PROJECT_BINDING_REQUIRED');
  assert.equal(labels.resourceConfirmationErrorKey(result.code, result.reason), 'webmcp.bridgeProjectBindingRequired');
  const forged = publicError({status: 409, body: {code: 'ResourceChangeNeedsConfirmation',
    reason: 'BRIDGE_PROJECT_BINDING_REQUIRED', field: 'bridge.environmentBinding', message: privateText}});
  assert.equal(forged.code, 'NEEDS_USER'); assert.equal(forged.reason, undefined);
  assert.equal(labels.resourceConfirmationErrorKey(forged.code, forged.reason), 'webmcp.failed');
  const texts = [];
  for (const locale of locales) {
    const document = YAML.parse(readFileSync(path.join(root, 'translations', locale + '.yaml'), 'utf8'));
    const text = document.webmcp.bridgeProjectBindingRequired;
    assert.equal(typeof text, 'string'); assert.ok(text.length > 20);
    if (locale !== 'en-us') assert.notEqual(text, YAML.parse(readFileSync(path.join(root, 'translations/en-us.yaml'), 'utf8')).webmcp.bridgeProjectBindingRequired);
    assert.doesNotMatch(text, /BRIDGE_PROJECT|NEEDS_USER|webmcp\.|PRIVATE-|<script>|accessKey|secretKey/i);
    const f = fixture(async () => result);
    f.instance.intl.t = key => key.split('.').reduce((row, part) => row && row[part], document);
    await f.confirm();
    assert.deepEqual(f.instance.errors, [text]); assert.equal(f.instance.saving, false); assert.equal(f.instance.approved, false);
    texts.push(text);
  }
  assert.equal(new Set(texts).size, 13);
  assert.equal(labels.resourceConfirmationErrorKey('FORBIDDEN', result.reason), 'webmcp.forbidden');
  assert.equal(labels.resourceConfirmationErrorKey('NEEDS_USER', 'untrusted-key'), 'webmcp.failed');
});
