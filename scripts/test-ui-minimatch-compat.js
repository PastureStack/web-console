'use strict';

// Only the official preprocessing fix and its directly affected build callers.
// Run after the explicit source-build apply; this test never patches dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const ownerRequire = name => createRequire(require.resolve(name + '/package.json'));
const matcherRequire = ownerRequire('@ember-tooling/blueprint-model');
const matcherPath = matcherRequire.resolve('minimatch/package.json');
const matcher = matcherRequire('minimatch');
const pattern = 'root/**/../a/b/**/../c/d';

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pst-minimatch-compat-'));
  try {
    fs.mkdirSync(path.join(directory, 'sub'));
    for (const file of ['a.js', 'b.txt', 'sub/c.js']) fs.writeFileSync(path.join(directory, file), 'ok\n');
    return run(directory);
  } finally {
    const target = path.resolve(directory);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('pst-minimatch-compat-'));
    fs.rmSync(target, { recursive: true });
  }
}

test('all affected installed matcher nodes and direct edges use the verified source backport', () => {
  const { applyProject } = require('./apply-minimatch-security-backport.cjs');
  const proof = applyProject(root, true);
  assert.equal(proof.status, 'MINIMATCH_SOURCE_BACKPORT_VERIFIED');
  assert.equal(proof.changedPackages, 0);
  const semver = require('semver');
  let affected = 0, edges = 0;
  for (const [name, row] of Object.entries(lock.packages)) {
    const packageName = row.name || name.split('node_modules/').at(-1);
    if (packageName === 'minimatch' && semver.satisfies(row.version, '>=7.0.0 <11.0.1')) {
      assert.equal(row.version, '10.2.6');
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, name, 'backport.json'), 'utf8')).cve, 'CVE-2026-118764');
      affected++;
    }
    const spec = { ...row.dependencies, ...row.optionalDependencies }.minimatch;
    if (spec && semver.validRange(spec) && semver.intersects(spec, '>=7.0.0 <11.0.1')) {
      const consumer = createRequire(path.join(root, name, 'package.json'));
      const resolved = consumer.resolve('minimatch/package.json');
      assert.equal(JSON.parse(fs.readFileSync(resolved, 'utf8')).version, '10.2.6');
      assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(resolved), 'backport.json'), 'utf8')).cve, 'CVE-2026-118764');
      edges++;
    }
  }
  assert.ok(affected >= 9 && edges >= 9, 'the actual lock/edge closure must be exercised');
});

test('CommonJS and ESM retain matchOne, makeRe and RegExp set entries', async () => {
  const esm = await import(pathToFileURL(path.join(path.dirname(matcherPath), 'dist/esm/index.js')).href);
  for (const { Minimatch } of [matcher, esm]) {
    const instance = new Minimatch('src/**/*.js');
    assert.equal(typeof instance.matchOne, 'function');
    assert.ok(instance.makeRe() instanceof RegExp);
    assert.ok(instance.set[0].some(part => part instanceof RegExp));
    assert.equal(instance.match('src/nested/a.js'), true);
    assert.equal(instance.match('src/nested/a.txt'), false);
    assert.equal(instance.matchOne(['src', 'nested'], instance.set[0], true), true);
  }
});

test('build SBOM records verified patched bytes while retaining the real npm name/version', () => {
  const { annotateBuildBackport } = require('./generate-ui-sbom');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const { applyProject } = require('./apply-minimatch-security-backport.cjs');
  const proof = applyProject(root, true);
  const components = new Map(proof.packages.map(location => [location,
    { component: { name: 'minimatch', version: '10.2.6', properties: [] } }]));
  const qualified = annotateBuildBackport(root, pkg, components);
  assert.equal(qualified.originalNpmIdentityRetained, true);
  assert.equal(qualified.rawVulnerabilityReportsRewritten, false);
  for (const { component } of components.values()) {
    assert.equal(component.version, '10.2.6');
    assert.ok(component.properties.some(value => value.name === 'pasturestack:security-backport' && value.value === 'CVE-2026-118764'));
  }
  components.values().next().value.component.version = '11.0.1';
  assert.throws(() => annotateBuildBackport(root, pkg, components), /actual installed SBOM component/);
  assert.equal(annotateBuildBackport(root, { overrides: {} }, new Map()), undefined);
});

test('bounded original amplification pattern respects the upstream braceExpandMax', async () => {
  const esm = await import(pathToFileURL(path.join(path.dirname(matcherPath), 'dist/esm/index.js')).href);
  for (const { Minimatch } of [matcher, esm]) {
    assert.ok(new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 2 }).globParts.length <= 2);
    assert.ok(new Minimatch('a/**/../b/c/**/../d/e/**/../f/g', {
      optimizationLevel: 2, braceExpandMax: 3,
    }).globParts.length <= 3);
  }
});

test('1001 small rows do not enter quadratic pairwise optimization', () => {
  const instance = new matcher.Minimatch('*.js');
  let comparisons = 0;
  instance.partsMatch = () => { comparisons++; throw new Error('PAIRWISE_OPTIMIZATION_REACHED'); };
  const rows = Array.from({ length: 1001 }, (_, index) => ['file' + index]);
  assert.equal(instance.secondPhasePreProcess(rows), rows);
  assert.equal(comparisons, 0);
});

test('the installed glob default wrapper uses the official raw entry and the bounded matcher', () => {
  const glob = require('glob');
  assert.equal(glob.default, glob);
  assert.equal(glob.__esModule, undefined);
  // glob 13 does not forward braceExpandMax. Observe the actual external
  // class instead of claiming an unsupported glob option reaches minimatch.
  const globMatcher = ownerRequire('glob-real')('minimatch').Minimatch;
  const preprocessing = globMatcher.prototype.firstPhasePreProcess;
  let calls = 0;
  globMatcher.prototype.firstPhasePreProcess = function(...args) {
    calls++;
    return preprocessing.apply(this, args);
  };
  try { new glob.Glob(pattern, { optimizationLevel: 2 }); }
  finally { globMatcher.prototype.firstPhasePreProcess = preprocessing; }
  assert.ok(calls > 0, 'the default wrapper must use the verified external matcher');
  assert.ok(require.cache[require.resolve('glob-real/raw')]);
  assert.equal(require.cache[require.resolve('glob-real')], undefined, 'the embedded unpatched default bundle must not execute');
  fixture(directory => assert.deepEqual(glob.sync('**/*.js', { cwd: directory })
    .map(value => value.replace(/\\/g, '/')).sort(), ['a.js', 'sub/c.js']));
});

test('walk-sync pruning and funnel string/RegExp filters retain their native behavior', () => fixture(directory => {
  const funnelRequire = ownerRequire('broccoli-funnel');
  const walk = funnelRequire('walk-sync');
  assert.equal(funnelRequire('walk-sync/package.json').version, '4.0.2');
  assert.deepEqual(walk(directory, { globs: ['**/*.js'], directories: false, globOptions: { dot: true } }).sort(), ['a.js', 'sub/c.js']);
  const module = require('broccoli-funnel');
  const Funnel = module.default || module.Funnel || module;
  const funnel = new Funnel([directory], { include: ['**/*.js'], exclude: [/\.txt$/] });
  // The filter's own ESM constructor identity is authoritative.
  assert.equal(funnel.include[0].match('sub/c.js'), true);
  assert.ok(funnel.exclude[0] instanceof RegExp);
}));

test('Babel literal root and Linux wildcard roots continue to resolve', () => fixture(directory => {
  const module = require('babel-plugin-module-resolver/lib/normalizeOptions');
  const normalize = module.default || module;
  assert.ok(normalize(directory, { root: [directory] }).root.includes(directory));
  if (process.platform !== 'win32') {
    assert.ok(normalize(directory, { root: [path.join(directory, '*')] }).root.includes(path.join(directory, 'sub')));
  }
}));

test('testem path matching and quick-temp create/remove remain compatible', () => {
  const { pathMatchesPattern } = require('testem/lib/utils/path_pattern_match');
  assert.equal(pathMatchesPattern('sub/c.js', '**/*.js'), true);
  assert.equal(pathMatchesPattern('sub/c.txt', '**/*.js'), false);
  const quick = require('quick-temp');
  const holder = {};
  quick.makeOrRemake(holder, 'directory', 'pst-minimatch-compat');
  assert.ok(holder.directory && fs.statSync(holder.directory).isDirectory());
  const target = path.resolve(holder.directory);
  assert.ok((target.startsWith(path.resolve(os.tmpdir()) + path.sep) || target.startsWith(path.join(root, 'tmp') + path.sep))
    && path.basename(target).startsWith('pst_minimatch_compat-'));
  quick.remove(holder, 'directory');
  assert.equal(holder.directory, null);
  assert.equal(fs.existsSync(target), false);
});
