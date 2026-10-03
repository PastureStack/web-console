'use strict';

// Deterministic npm12 report shapes; no install, audit, registry, or build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { evaluateAudit, validateReviewedImports, runAudit } = require('./check-ui-npm-audit');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const pending = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/npm-vendor-pending.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const now = new Date('2026-10-04T00:00:00Z');
const dependencyCounts = { prod: 8, dev: 1454, optional: 18, peer: 1, peerOptional: 0, total: 1477 };
const knownVia = {
  braces: [{ source: 1240992, name: 'braces', dependency: 'braces',
    title: 'braces vulnerable to stack-exhaustion denial of service through deeply nested patterns',
    url: pending.advisoryUrl, severity: 'high', cwe: ['CWE-674'],
    cvss: { score: 7.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H' }, range: '<=3.0.3' }],
  micromatch: ['braces'],
  'findup-sync': ['micromatch'],
  'find-yarn-workspace-root': ['micromatch'],
  sane: ['micromatch'],
  broccoli: ['findup-sync', 'sane'],
  'ember-cli': ['broccoli', 'find-yarn-workspace-root', 'sane']
};
function report(withHigh = true, withModerate = false) {
  const vulnerabilities = {};
  if (withHigh) for (const [name, via] of Object.entries(knownVia)) vulnerabilities[name] = {
    name, severity: 'high', isDirect: name === 'ember-cli', via: clone(via),
    effects: Object.keys(knownVia).filter(n => knownVia[n].includes(name)), range: '*', nodes: ['node_modules/' + name],
    fixAvailable: { name: 'ember-cli', version: '3.3.0', isSemVerMajor: true }
  };
  if (withModerate) vulnerabilities['fast-uri'] = {
    name: 'fast-uri', severity: 'moderate', isDirect: false,
    via: [{ source: 1240091, name: 'fast-uri', dependency: 'fast-uri', title: 'Separate Moderate advisory',
      url: 'https://github.com/advisories/GHSA-hrr3-gc8f-f4qj', severity: 'moderate', cwe: ['CWE-178'],
      cvss: { score: 4.8, vectorString: null }, range: '>=3.0.0 <3.1.8' }],
    effects: [], range: '3.0.0 - 3.1.7', nodes: ['node_modules/fast-uri'], fixAvailable: true
  };
  return { auditReportVersion: 2, vulnerabilities,
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: withModerate ? 1 : 0, high: withHigh ? 7 : 0,
      critical: 0, total: (withHigh ? 7 : 0) + (withModerate ? 1 : 0) }, dependencies: clone(dependencyCounts) } };
}
function input(audit = report()) { return { audit, lock: clone(lock), pending: clone(pending), now, npmExitCode: audit.metadata.vulnerabilities.high ? 1 : 0 }; }
function fail(value, code) {
  const result = evaluateAudit(value);
  assert.equal(result.ok, false);
  assert.equal(result.outcome, 'FAIL_CLOSED');
  if (code) assert.equal(result.failureCode, code);
  return result;
}

test('clean High/Critical report passes without claiming zero Moderate or runtime unaffected', () => {
  const result = evaluateAudit(input(report(false, true)));
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'PASS_HIGH_CRITICAL_CLEAN');
  assert.equal(result.totals.moderate, 1);
  assert.equal(result.knownPending, null);
  assert.equal(result.runtimeNotAffectedClaim, false);
});
test('exact actual seven-node npm12 closure passes and keeps raw High plus separate Moderate', () => {
  const result = evaluateAudit(input(report(true, true)));
  assert.equal(result.ok, true);
  assert.equal(result.outcome, 'PASS_BUILD_VENDOR_PENDING');
  assert.equal(result.totals.high, 7);
  assert.equal(result.totals.moderate, 1);
  assert.equal(result.totals.critical, 0);
  assert.equal(result.knownPending.metavulnerabilityCount, 6);
  assert.equal(result.knownPending.upstreamPatchedVersion, null);
});
test('unknown High or extra direct advisory cannot borrow the known package name', () => {
  const value = input();
  value.audit.vulnerabilities.braces.via[0].url = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
  fail(value, 'UNREVIEWED_DIRECT_ADVISORY');
  const extra = input();
  extra.audit.vulnerabilities.braces.via.push({ ...extra.audit.vulnerabilities.braces.via[0], source: 99,
    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' });
  fail(extra, 'UNREVIEWED_DIRECT_ADVISORY');
});
test('Critical always blocks, including a known advisory promoted to Critical', () => {
  const value = input();
  value.audit.vulnerabilities.braces.severity = 'critical';
  value.audit.metadata.vulnerabilities.high--;
  value.audit.metadata.vulnerabilities.critical++;
  assert.equal(fail(value, 'CRITICAL_VULNERABILITY').totals.critical, 1);
});

test('a Moderate wrapper cannot conceal a High or Critical direct or meta advisory', () => {
  for (const severity of ['high', 'critical']) {
    const value = input(report(true, true));
    value.audit.vulnerabilities['fast-uri'].via[0].severity = severity;
    fail(value, 'AUDIT_SEVERITY_INCONSISTENT');
  }
  const meta = input(report(true, true));
  meta.audit.vulnerabilities['fast-uri'].via = ['braces'];
  fail(meta, 'AUDIT_SEVERITY_INCONSISTENT');
});
test('version, resolved URL, integrity, and dev flag changes each invalidate exact node review', () => {
  for (const [key, val] of [['version', '3.0.4'], ['resolved', 'https://example.invalid/braces.tgz'],
    ['integrity', 'sha512-different'], ['dev', false]]) {
    const value = input(); value.lock.packages['node_modules/braces'][key] = val;
    fail(value, 'LOCK_NODE_REVIEW_MISMATCH');
  }
});
test('root version changes do not stale unchanged dependency review', () => {
  const value = input(); value.lock.packages[''].version = '1.6.999';
  assert.equal(evaluateAudit(value).ok, true);
});
test('production reachability or shipped node blocks publication boundary', () => {
  const value = input(); value.lock.packages[''].dependencies.braces = '3.0.3';
  fail(value, 'PENDING_NODE_SHIPPED');
  const shipped = input(); shipped.pending.shippedNodes = ['node_modules/braces'];
  fail(shipped, 'PENDING_POLICY_INVALID');
});
test('additional braces major/node, consumer closure, or changed edge rejects rather than broadening exception', () => {
  const value = input(); value.lock.packages['node_modules/other/node_modules/braces'] = clone(value.lock.packages['node_modules/braces']);
  fail(value, 'BRACES_NODE_MISMATCH');
  const consumer = input(); consumer.lock.packages['node_modules/other'] = { dev: true, version: '1.0.0', dependencies: { braces: '^3.0.3' } };
  fail(consumer, 'LOCK_CLOSURE_REVIEW_MISMATCH');
  const edge = input(); edge.lock.packages['node_modules/micromatch'].dependencies.braces = '*';
  fail(edge, 'LOCK_EDGE_REVIEW_MISMATCH');
});
test('all meta branches must resolve actual lock dependencies and exact advisory', () => {
  const value = input(); value.audit.vulnerabilities.broccoli.via.push('braces');
  fail(value, 'METAVULNERABILITY_LOCK_EDGE_MISMATCH');
  const missing = input(); missing.audit.vulnerabilities.micromatch.via = ['missing-package'];
  fail(missing, 'AUDIT_VIA_REFERENCE_INVALID');
});
test('meta cycle rejects even when synthetic lock graph supplies that edge', () => {
  const value = input();
  value.lock.packages['node_modules/braces'].dependencies.micromatch = '^4.0.8';
  value.pending.edges.push({ from: 'node_modules/braces', to: 'node_modules/micromatch', spec: '^4.0.8' });
  value.audit.vulnerabilities.braces.via = ['micromatch'];
  fail(value, 'METAVULNERABILITY_CYCLE');
});
test('missing closure node or inconsistent effects cannot manufacture a complete pending decision', () => {
  const value = input(); delete value.audit.vulnerabilities['ember-cli'];
  for (const v of Object.values(value.audit.vulnerabilities)) v.effects = v.effects.filter(n => n !== 'ember-cli');
  value.audit.metadata.vulnerabilities.high--; value.audit.metadata.vulnerabilities.total--;
  fail(value, 'AUDIT_HIGH_CLOSURE_INCOMPLETE');
  const effects = input(); effects.audit.vulnerabilities.braces.effects = [];
  fail(effects, 'AUDIT_METAVULNERABILITY_EFFECTS_MISMATCH');
});
test('review expiration boundary is UTC and future/invalid dates reject', () => {
  for (const at of ['2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z', '2026-10-02T00:00:00Z', 'invalid']) {
    const value = input(); value.now = new Date(at); fail(value, 'PENDING_REVIEW_EXPIRED_OR_INVALID');
  }
});
test('npm error, malformed report, unknown shape, missing metadata and bad totals reject safely', () => {
  const error = input(); error.audit.error = { summary: 'secret-stderr-marker' }; fail(error, 'NPM_AUDIT_SHAPE_OR_ERROR');
  const shape = input(); shape.audit.auditReportVersion = 1; fail(shape, 'NPM_AUDIT_SHAPE_OR_ERROR');
  const meta = input(); delete meta.audit.metadata; fail(meta, 'NPM_AUDIT_SHAPE_OR_ERROR');
  const extra = input(); extra.audit.vulnerabilities.braces.unknown = true; fail(extra, 'NPM_VULNERABILITY_SHAPE_INVALID');
  const totals = input(); totals.audit.metadata.vulnerabilities.high = 0; totals.audit.metadata.vulnerabilities.total = 0;
  fail(totals, 'NPM_AUDIT_TOTALS_MISMATCH');
});
test('npm non-audit failures and inconsistent exit status never become allowed pending', () => {
  for (const status of [null, 2, 127, 0]) { const value = input(); value.npmExitCode = status; fail(value, 'NPM_EXIT_OR_NETWORK_ERROR'); }
});
test('main runner truly selects high JSON audit once, never install/fix, and emits no raw stderr/error', () => {
  let calls = 0;
  const result = runAudit(root, (command, args, options) => {
    calls++;
    assert.deepEqual(args.slice(-3), ['audit', '--audit-level=high', '--json']);
    assert.equal(options.shell, false);
    assert.equal(options.cwd, root);
    assert.equal(args.includes('fix'), false);
    return { status: 1, stdout: JSON.stringify(report()), stderr: 'private stderr marker' };
  });
  assert.equal(calls, 1); assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes('private'), false);
});
test('runner malformed JSON, network errors and thrown process errors are finite safe codes with no retry', () => {
  for (const returned of [{ status: 1, stdout: 'secret invalid body' },
    { status: 1, stdout: JSON.stringify({ error: { code: 'ENOTFOUND', detail: 'secret' } }) },
    { status: null, error: new Error('secret network failure'), stdout: '' }]) {
    let calls = 0;
    const result = runAudit(root, () => { calls++; return returned; });
    assert.equal(calls, 1); assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
  let calls = 0;
  const result = runAudit(root, () => { calls++; throw new Error('secret thrown failure'); });
  assert.equal(calls, 1); assert.equal(result.failureCode, 'NPM_PROCESS_ERROR');
});
test('reviewed runtime import boundary refuses every pending consumer while exact Ember build entry is allowed', () => {
  const sources = { 'ember-cli-build.js': "var EmberApp = require('ember-cli/lib/broccoli/ember-app');",
    'app/app.js': "import App from '@ember/application';", 'vendor/example.js': 'const braces = [1, 2];' };
  assert.doesNotThrow(() => validateReviewedImports(sources, pending));
  for (const node of pending.nodes) {
    const name = node.path.slice('node_modules/'.length);
    for (const content of ["import x from '" + name + "';", "require('" + name + "/index.js');",
      "import('" + name + "');", "app.import('node_modules/" + name + "/index.js');"]) {
      assert.throws(() => validateReviewedImports({ ...sources, 'app/changed.js': content }, pending),
        { message: 'PENDING_NODE_BROWSER_IMPORT' });
    }
  }
  assert.throws(() => validateReviewedImports({ ...sources, 'ember-cli-build.js': "app.import('node_modules/braces/index.js');" }, pending),
    { message: 'PENDING_NODE_BROWSER_IMPORT' });
});
