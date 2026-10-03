'use strict';

// npm severity is not rewritten. This is a time-bounded build-input decision,
// not a fix, a runtime VEX claim, or permission to ship the affected modules.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const strings = v => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0) && new Set(v).size === v.length;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const packageName = p => p.split('node_modules/').at(-1);
function need(ok, code) { if (!ok) throw new Error(code); }

function resolveDependency(packages, from, name) {
  let current = from;
  while (true) {
    const candidate = (current ? current + '/' : '') + 'node_modules/' + name;
    if (own(packages, candidate)) return candidate;
    if (!current) return null;
    const parent = current.lastIndexOf('/node_modules/');
    current = parent < 0 ? '' : current.slice(0, parent);
  }
}

function validatePending(lock, pending, now) {
  need(plain(pending) && pending.schemaVersion === 1 && pending.advisoryUrl === ADVISORY &&
    pending.severity === 'high' && pending.upstreamPatchedVersion === null &&
    pending.scope === 'controlled-dev-build-inputs-only' && pending.publicationBlockedIfShippedNodes === true &&
    strings(pending.shippedNodes) && pending.shippedNodes.length === 0, 'PENDING_POLICY_INVALID');
  need(pending.reviewUntil === '2026-10-10' && typeof pending.reviewedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(pending.reviewedAt) &&
    Number.isFinite(Date.parse(pending.reviewedAt)) && Number.isFinite(now.getTime()) &&
    now.getTime() >= Date.parse(pending.reviewedAt) && now.getTime() < Date.parse(pending.reviewUntil + 'T00:00:00Z'),
  'PENDING_REVIEW_EXPIRED_OR_INVALID');
  need(plain(lock) && lock.lockfileVersion === 3 && plain(lock.packages) && plain(lock.packages['']), 'LOCK_SHAPE_INVALID');
  need(Array.isArray(pending.nodes) && pending.nodes.length > 0 && Array.isArray(pending.edges), 'PENDING_NODE_SHAPE_INVALID');
  const packages = lock.packages;
  const pinned = pending.nodes.map(n => n.path);
  need(strings(pinned) && pinned.includes('node_modules/braces'), 'PENDING_NODE_SHAPE_INVALID');
  for (const n of pending.nodes) {
    need(plain(n) && /^node_modules\/(?:[^/]+\/node_modules\/)*[^/]+$/.test(n.path) &&
      typeof n.version === 'string' && typeof n.resolved === 'string' && typeof n.integrity === 'string' && n.dev === true,
    'PENDING_NODE_SHAPE_INVALID');
    const actual = packages[n.path];
    need(plain(actual) && ['version', 'resolved', 'integrity', 'dev'].every(k => actual[k] === n[k]) &&
      actual.link !== true && actual.devOptional !== true, 'LOCK_NODE_REVIEW_MISMATCH');
  }
  const bracePaths = Object.keys(packages).filter(p => packageName(p) === 'braces');
  need(sameSet(bracePaths, ['node_modules/braces']) && packages['node_modules/braces'].version === '3.0.3', 'BRACES_NODE_MISMATCH');
  const edges = [];
  for (const [from, node] of Object.entries(packages)) {
    if (!from) continue;
    for (const [name, spec] of Object.entries({ ...node.dependencies, ...node.optionalDependencies })) {
      const to = resolveDependency(packages, from, name);
      if (to) edges.push({ from, to, spec });
    }
  }
  const closure = new Set(bracePaths);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) if (closure.has(e.to) && !closure.has(e.from)) { closure.add(e.from); changed = true; }
  }
  need(sameSet([...closure], pinned), 'LOCK_CLOSURE_REVIEW_MISMATCH');
  const edgeKey = e => JSON.stringify([e.from, e.to, e.spec]);
  const actualEdges = edges.filter(e => closure.has(e.from) && closure.has(e.to)).map(edgeKey);
  need(pending.edges.every(e => plain(e) && pinned.includes(e.from) && pinned.includes(e.to) && typeof e.spec === 'string') &&
    sameSet(actualEdges, pending.edges.map(edgeKey)) && new Set(pending.edges.map(edgeKey)).size === pending.edges.length,
  'LOCK_EDGE_REVIEW_MISMATCH');
  // dev:true is necessary but not sufficient: a production-root dependency
  // reaching the pending closure also invalidates the build-only boundary.
  const production = Object.keys({ ...packages[''].dependencies, ...packages[''].optionalDependencies })
    .map(n => resolveDependency(packages, '', n)).filter(Boolean);
  const seen = new Set(production);
  for (let i = 0; i < production.length; i++) {
    const from = production[i];
    need(!closure.has(from), 'PENDING_NODE_SHIPPED');
    for (const e of edges) if (e.from === from && !seen.has(e.to)) { seen.add(e.to); production.push(e.to); }
  }
  return { packages, pinned, edges };
}

function validateReviewedImports(sources, pending) {
  const names = new Set(pending.nodes.map(n => packageName(n.path)));
  need(plain(sources) && Object.keys(sources).includes('ember-cli-build.js') &&
    Object.keys(sources).every(p => p === 'ember-cli-build.js' || /^(app|config|vendor)\/.*\.js$/.test(p)),
  'BROWSER_SOURCE_INPUT_INVALID');
  for (const [file, source] of Object.entries(sources)) {
    need(typeof source === 'string', 'BROWSER_SOURCE_INPUT_INVALID');
    const imports = /\b(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s*|app\.import\s*\(\s*)['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) {
      const spec = match[1].replace(/^node_modules\//, '');
      const name = spec.split('/')[0];
      if (!names.has(name)) continue;
      need(file === 'ember-cli-build.js' && match[1] === 'ember-cli/lib/broccoli/ember-app', 'PENDING_NODE_BROWSER_IMPORT');
    }
  }
  // Static imports alone cannot prove artifact contents. Publication still
  // requires the separate packaged-browser inventory; never emit notAffected.
}

function readReviewedSources(repoRoot, io = fs) {
  const sources = { 'ember-cli-build.js': io.readFileSync(path.join(repoRoot, 'ember-cli-build.js'), 'utf8') };
  function walk(relative) {
    for (const entry of io.readdirSync(path.join(repoRoot, relative), { withFileTypes: true })) {
      const file = relative + '/' + entry.name;
      // Cold npm ci installs local-addon dependencies here, including Unix
      // .bin symlinks. They are audited by the full lock/report, not owned JS.
      // Only that exact directory boundary is excluded; source links and
      // node_modules under app/config are still refused.
      if (entry.name === 'node_modules' && entry.isDirectory()) {
        need(/^vendor\/[^/]+$/.test(relative), 'BROWSER_SOURCE_DEPENDENCY_BOUNDARY_INVALID');
        continue;
      }
      need(!entry.isSymbolicLink(), 'BROWSER_SOURCE_SYMLINK_UNREVIEWED');
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.js')) sources[file] = io.readFileSync(path.join(repoRoot, file), 'utf8');
    }
  }
  for (const directory of ['app', 'config', 'vendor']) walk(directory);
  return sources;
}

function evaluateAudit({ audit, lock, pending, now = new Date(), npmExitCode }) {
  let totals = null;
  try {
    const { packages, pinned } = validatePending(lock, pending, now);
    need(plain(audit) && audit.auditReportVersion === 2 && !own(audit, 'error') &&
      plain(audit.vulnerabilities) && plain(audit.metadata) && plain(audit.metadata.vulnerabilities) &&
      plain(audit.metadata.dependencies), 'NPM_AUDIT_SHAPE_OR_ERROR');
    const counts = audit.metadata.vulnerabilities;
    need(sameSet(Object.keys(counts), [...LEVELS, 'total']) &&
      [...LEVELS, 'total'].every(k => Number.isSafeInteger(counts[k]) && counts[k] >= 0) &&
      LEVELS.reduce((n, k) => n + counts[k], 0) === counts.total, 'NPM_AUDIT_TOTALS_INVALID');
    totals = Object.fromEntries([...LEVELS, 'total'].map(k => [k, counts[k]]));
    // A reported Critical always blocks before meta-severity consistency;
    // a newly promoted child must not be hidden by its old High wrappers.
    need(totals.critical === 0, 'CRITICAL_VULNERABILITY');
    need(sameSet(Object.keys(audit.metadata.dependencies), ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total']) &&
      Object.values(audit.metadata.dependencies).every(n => Number.isSafeInteger(n) && n >= 0), 'NPM_AUDIT_DEPENDENCIES_INVALID');
    const vulnerabilities = audit.vulnerabilities;
    const observed = Object.fromEntries(LEVELS.map(k => [k, 0]));
    const allowedKeys = ['name', 'severity', 'isDirect', 'via', 'effects', 'range', 'nodes', 'fixAvailable'];
    for (const [name, v] of Object.entries(vulnerabilities)) {
      need(plain(v) && Object.keys(v).every(k => allowedKeys.includes(k)) && v.name === name && LEVELS.includes(v.severity) &&
        typeof v.isDirect === 'boolean' && typeof v.range === 'string' && strings(v.nodes) && v.nodes.length > 0 &&
        strings(v.effects) && Array.isArray(v.via) && v.via.length > 0 &&
        (typeof v.fixAvailable === 'boolean' || (plain(v.fixAvailable) && typeof v.fixAvailable.name === 'string' &&
          typeof v.fixAvailable.version === 'string' && typeof v.fixAvailable.isSemVerMajor === 'boolean')), 'NPM_VULNERABILITY_SHAPE_INVALID');
      observed[v.severity]++;
      for (const node of v.nodes) need(plain(packages[node]) && packageName(node) === name, 'AUDIT_NODE_LOCK_MISMATCH');
      for (const e of v.effects) need(own(vulnerabilities, e), 'AUDIT_EFFECT_REFERENCE_INVALID');
      need(new Set(v.via.map(x => typeof x === 'string' ? 'meta:' + x : 'advisory:' + x?.url)).size === v.via.length,
        'AUDIT_VIA_DUPLICATE');
      for (const via of v.via) {
        if (typeof via === 'string') {
          need(own(vulnerabilities, via), 'AUDIT_VIA_REFERENCE_INVALID');
          need(LEVELS.indexOf(v.severity) >= LEVELS.indexOf(vulnerabilities[via].severity), 'AUDIT_SEVERITY_INCONSISTENT');
        }
        else need(plain(via) && Object.keys(via).every(k => ['source', 'name', 'dependency', 'title', 'url', 'severity', 'cwe', 'cvss', 'range'].includes(k)) &&
          Number.isSafeInteger(via.source) && via.source > 0 && via.name === name &&
          via.dependency === name && typeof via.title === 'string' && typeof via.url === 'string' &&
          /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/.test(via.url) && LEVELS.includes(via.severity) &&
          typeof via.range === 'string' && strings(via.cwe) && plain(via.cvss) && Number.isFinite(via.cvss.score) &&
          (via.cvss.vectorString === null || typeof via.cvss.vectorString === 'string'), 'AUDIT_ADVISORY_SHAPE_INVALID');
        if (typeof via !== 'string') need(LEVELS.indexOf(v.severity) >= LEVELS.indexOf(via.severity), 'AUDIT_SEVERITY_INCONSISTENT');
      }
    }
    need(LEVELS.every(k => observed[k] === totals[k]), 'NPM_AUDIT_TOTALS_MISMATCH');
    need(npmExitCode === (totals.high + totals.critical > 0 ? 1 : 0), 'NPM_EXIT_OR_NETWORK_ERROR');
    const visiting = new Set();
    const verified = new Set();
    function knownClosure(name) {
      if (verified.has(name)) return;
      need(!visiting.has(name), 'METAVULNERABILITY_CYCLE');
      visiting.add(name);
      const v = vulnerabilities[name];
      need(v.severity === 'high' && v.nodes.every(n => pinned.includes(n)), 'UNREVIEWED_HIGH_NODE');
      for (const via of v.via) {
        if (typeof via === 'string') {
          need(v.nodes.every(from => {
            const spec = { ...packages[from].dependencies, ...packages[from].optionalDependencies }[via];
            return typeof spec === 'string' && vulnerabilities[via].nodes.includes(resolveDependency(packages, from, via));
          }), 'METAVULNERABILITY_LOCK_EDGE_MISMATCH');
          knownClosure(via);
        } else {
          need(name === 'braces' && via.name === 'braces' && via.dependency === 'braces' && via.severity === 'high' &&
            via.url === ADVISORY && via.range === '<=3.0.3', 'UNREVIEWED_DIRECT_ADVISORY');
        }
      }
      visiting.delete(name);
      verified.add(name);
    }
    const high = Object.keys(vulnerabilities).filter(n => vulnerabilities[n].severity === 'high');
    for (const name of high) knownClosure(name);
    if (high.length) {
      need(sameSet(high.flatMap(n => vulnerabilities[n].nodes), pinned), 'AUDIT_HIGH_CLOSURE_INCOMPLETE');
      for (const name of high) {
        const parents = high.filter(n => vulnerabilities[n].via.includes(name));
        need(sameSet(vulnerabilities[name].effects, parents), 'AUDIT_METAVULNERABILITY_EFFECTS_MISMATCH');
      }
    }
    return { ok: true, outcome: high.length ? 'PASS_BUILD_VENDOR_PENDING' : 'PASS_HIGH_CRITICAL_CLEAN', totals,
      knownPending: high.length ? { advisory: 'GHSA-vfj7-8cjw-p6xm', severity: 'high', vulnerableNodeCount: 1,
        metavulnerabilityCount: high.length - 1, reviewUntil: pending.reviewUntil, upstreamPatchedVersion: null } : null,
      runtimeNotAffectedClaim: false };
  } catch (error) {
    return { ok: false, outcome: 'FAIL_CLOSED', totals, failureCode: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_EVALUATION_ERROR' };
  }
}

function runAudit(repoRoot, runner = spawnSync) {
  let lock, pending;
  try {
    lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
    pending = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/security/npm-vendor-pending.json'), 'utf8'));
    validatePending(lock, pending, new Date());
    validateReviewedImports(readReviewedSources(repoRoot), pending);
  } catch (error) {
    return { ok: false, outcome: 'FAIL_CLOSED', totals: null,
      failureCode: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PREFLIGHT_INPUT_ERROR' };
  }
  let command = 'npm';
  let args = ['audit', '--audit-level=high', '--json'];
  if (process.platform === 'win32') {
    const candidates = [path.join(process.env.APPDATA || '', 'npm/node_modules/npm/bin/npm-cli.js'),
      path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')];
    const cli = candidates.find(p => {
      try { return fs.existsSync(p) && JSON.parse(fs.readFileSync(path.resolve(p, '../../package.json'), 'utf8')).version === '12.0.2'; }
      catch (_) { return false; }
    });
    if (!cli) return { ok: false, outcome: 'FAIL_CLOSED', totals: null, failureCode: 'NPM_CLI_UNAVAILABLE' };
    command = process.execPath;
    args = [cli, ...args];
  }
  let result;
  try { result = runner(command, args, { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }); }
  catch (_) { return { ok: false, outcome: 'FAIL_CLOSED', totals: null, failureCode: 'NPM_PROCESS_ERROR' }; }
  if (!result || result.error || result.signal || ![0, 1].includes(result.status))
    return { ok: false, outcome: 'FAIL_CLOSED', totals: null, failureCode: 'NPM_EXIT_OR_NETWORK_ERROR' };
  let audit;
  try { audit = JSON.parse(result.stdout); }
  catch (_) { return { ok: false, outcome: 'FAIL_CLOSED', totals: null, failureCode: 'NPM_JSON_INVALID' }; }
  return evaluateAudit({ audit, lock, pending, npmExitCode: result.status });
}

module.exports = { evaluateAudit, validatePending, validateReviewedImports, readReviewedSources, runAudit };
if (require.main === module) {
  const result = runAudit(path.resolve(__dirname, '..'));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
