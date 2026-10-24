'use strict';

// SBOMs are release sidecars. This program never writes the browser tree or
// repacks the archive whose identity it records. No third-party generator is
// allowed to substitute the complete npm lock for the browser inventory.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const childProcess = require('node:child_process');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const slash = value => value.replace(/\\/g, '/');
const sort = values => [...values].sort();
const property = (name, value) => ({ name: 'pasturestack:' + name, value: String(value) });
const hashes = value => [{ alg: 'SHA-256', content: sha256(value) }];

function relative(value) {
  assert.equal(typeof value, 'string', 'inventory path must be a string');
  value = slash(value);
  assert.ok(value && !value.startsWith('/') && !/^[a-z]:/i.test(value) &&
    !value.split('/').includes('..') && !/[\x00-\x1f]/.test(value), 'unsafe inventory path');
  return value.replace(/^\.\//, '');
}

function walk(directory, prefix = '') {
  const out = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix + item.name;
    assert.ok(!item.isSymbolicLink(), 'symlinks are not permitted in release output');
    if (item.isDirectory()) out.push(...walk(path.join(directory, item.name), name + '/'));
    else { assert.ok(item.isFile(), 'unsupported release file'); out.push(name); }
  }
  return out.sort();
}

// Read, rather than extract, the exact original tar. PAX/long names are
// supported; unsafe names, links, duplicate files and damaged headers fail.
function readTar(archive) {
  const bytes = zlib.gunzipSync(fs.readFileSync(archive));
  const files = new Map();
  let extended = {}, globalExtended = {}, longName;
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) break;
    const field = (start, length) => header.subarray(start, start + length).toString('utf8').split('\0')[0];
    const octal = (start, length) => { const value = field(start, length).trim(); assert.ok(/^[0-7]*$/.test(value), 'invalid tar number'); return parseInt(value || '0', 8); };
    const checksum = [...header].reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    assert.equal(octal(148, 8), checksum, 'tar header checksum mismatch');
    const size = octal(124, 12), type = field(156, 1);
    assert.ok(offset + 512 + size <= bytes.length, 'truncated archive');
    const data = bytes.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x' || type === 'g') {
      const attrs = {};
      for (let i = 0; i < data.length;) {
        const space = data.indexOf(32, i), count = Number(data.subarray(i, space).toString());
        assert.ok(Number.isInteger(count) && count > 0 && i + count <= data.length, 'invalid PAX record');
        const record = data.subarray(space + 1, i + count - 1).toString(), equal = record.indexOf('=');
        attrs[record.slice(0, equal)] = record.slice(equal + 1); i += count;
      }
      if (type === 'g') globalExtended = { ...globalExtended, ...attrs }; else extended = attrs;
      continue;
    }
    if (type === 'L') { longName = data.toString().replace(/\0.*$/s, '').replace(/\n$/, ''); continue; }
    let name = extended.path || globalExtended.path || longName || [field(345, 155), field(0, 100)].filter(Boolean).join('/');
    extended = {}; longName = undefined;
    name = name.replace(/^\.\//, '');
    if (type === '5' || name === '') continue;
    assert.ok(type === '0' || type === '' || type === '\0', 'archive must contain regular files only');
    name = relative(name);
    assert.ok(!files.has(name), 'duplicate archive file'); files.set(name, data);
  }
  assert.ok(files.size > 0, 'empty archive');
  return files;
}

function packageName(location) {
  const match = location.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
  assert.ok(match, 'invalid npm lock location'); return match[1];
}

function purl(name, version) {
  const [scope, simple] = name.startsWith('@') ? name.split('/') : [null, name];
  return 'pkg:npm/' + (scope ? encodeURIComponent(scope) + '/' : '') + encodeURIComponent(simple) + '@' + encodeURIComponent(version);
}

function npmRef(location, namespace = 'npm') { return namespace + ':' + location; }

function license(value) {
  if (value && typeof value === 'object') value = value.type;
  if (!value || value === 'UNLICENSED') return [];
  // Keep upstream SPDX expressions (including OR/AND) intact.
  return [{ expression: value }];
}

function installedPackages(root, lock, namespace = 'npm') {
  assert.ok(lock.lockfileVersion >= 2 && lock.packages && lock.packages[''], 'npm lock packages are required');
  const installed = new Map();
  for (const location of Object.keys(lock.packages).filter(value => /(?:^|\/)node_modules\//.test(value)).sort()) {
    const entry = lock.packages[location];
    const target = entry.link ? relative(entry.resolved) : location;
    const targetEntry = lock.packages[target];
    assert.ok(targetEntry, 'lock link target is missing: ' + location);
    const file = path.join(root, location, 'package.json');
    if (!fs.existsSync(file)) {
      assert.ok(entry.optional || targetEntry.optional, 'installed lock package is missing: ' + location);
      continue;
    }
    const metadata = json(file), name = metadata.name || packageName(location);
    if (entry.link) assert.deepEqual(metadata, json(path.join(root, target, 'package.json')), 'installed local link differs from locked target');
    assert.equal(metadata.version, targetEntry.version, 'installed package version differs from lock: ' + location);
    assert.equal(name, targetEntry.name || packageName(location), 'installed package name differs from lock: ' + location);
    // Aliases use the published package name, never the installation alias.
    assert.ok(name && metadata.version, 'installed package identity is missing');
    const properties = [property('phase', 'build'), property('lock-location', location),
      property('npm-dev', Boolean(entry.dev || targetEntry.dev)), property('npm-optional', Boolean(entry.optional || targetEntry.optional))];
    if (targetEntry.integrity) properties.push(property('npm-integrity', targetEntry.integrity));
    if (entry.link || (targetEntry.resolved || '').startsWith('file:')) {
      properties.push(property('locally-modified', 'true'));
      properties.push(property('local-source-tree-sha256', sourceTreeHash(path.join(root, target))));
      if (metadata.rc16Maintenance) properties.push(property('local-patch', JSON.stringify(metadata.rc16Maintenance)));
      const provenance = path.join(root, target, 'UPSTREAM.md');
      if (fs.existsSync(provenance)) properties.push(property('provenance-sha256', sourceHash(provenance)));
      const archive = (targetEntry.resolved || '').replace(/^file:/, '');
      if (archive.endsWith('.tgz')) {
        assert.ok(fs.existsSync(path.join(root, archive)), 'local package archive is missing');
        properties.push(property('local-archive-sha256', sha256(fs.readFileSync(path.join(root, archive)))));
      }
    }
    const component = { type: 'library', 'bom-ref': npmRef(location, namespace), name, version: metadata.version,
      purl: purl(name, metadata.version), licenses: license(metadata.license || targetEntry.license), properties };
    installed.set(location, { location, target, entry: targetEntry, metadata, component });
  }
  assert.ok(installed.size > 0, 'installed npm closure is empty');
  return installed;
}

function resolveDependency(installed, from, name) {
  let directory = from;
  for (;;) {
    const candidate = (directory ? directory + '/' : '') + 'node_modules/' + name;
    if (installed.has(candidate)) return candidate;
    if (!directory) return undefined;
    directory = path.posix.dirname(directory); if (directory === '.') directory = '';
  }
}

function dependencyGraph(installed, lock, included, namespace = 'npm') {
  const dependencies = [];
  for (const location of sort(included)) {
    const item = installed.get(location), edges = new Set();
    for (const name of Object.keys({ ...item.entry.dependencies, ...item.entry.optionalDependencies, ...item.entry.peerDependencies }).sort()) {
      const target = resolveDependency(installed, item.target, name);
      const optional = Object.hasOwn(item.entry.optionalDependencies || {}, name) || item.entry.peerDependenciesMeta?.[name]?.optional;
      // npm omits platform-specific optional dependencies. Missing mandatory
      // dependencies mean this is not an actual complete installed closure.
      assert.ok(target || optional, 'unresolved installed dependency: ' + location + ' -> ' + name);
      if (target && included.has(target) && target !== location) edges.add(npmRef(target, namespace));
    }
    dependencies.push({ ref: npmRef(location, namespace), dependsOn: sort(edges) });
  }
  return dependencies;
}

// Git text files are canonical LF; binary source files retain their bytes.
// The release archive/file SHA-256 values always hash raw bytes.
function sourceHash(file) {
  const buffer = fs.readFileSync(file);
  const text = buffer.toString('utf8');
  const binary = /\.(?:woff2?|ttf|tgz|png|jpe?g|gif|ico)$/i.test(file) || buffer.includes(0) || !Buffer.from(text, 'utf8').equals(buffer);
  return sha256(binary ? buffer : text.replace(/\r\n/g, '\n'));
}

function sourceTreeHash(directory) {
  const files = [];
  function visit(current, prefix = '') {
    for (const item of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (item.name === 'node_modules' || item.name === '.git') continue;
      const name = prefix + item.name, file = path.join(current, item.name);
      assert.ok(!item.isSymbolicLink(), 'unexpected link in local package source');
      if (item.isDirectory()) visit(file, name + '/');
      else { assert.ok(item.isFile(), 'unsupported local package source'); files.push([name, sourceHash(file)]); }
    }
  }
  visit(directory);
  return sha256(JSON.stringify(files));
}

function vendorComponents(root, manifest) {
  assert.equal(manifest.schemaVersion, 1, 'unsupported vendor manifest');
  return manifest.components.map(item => {
    assert.ok(item.id && item.name && item.files && Object.keys(item.files).length, 'vendor source mapping is incomplete');
    for (const [file, digest] of Object.entries(item.files)) {
      assert.equal(sourceHash(path.join(root, relative(file))), digest, 'vendored source changed without provenance review: ' + file);
    }
    const digest = sha256(JSON.stringify(Object.entries(item.files).sort(([a], [b]) => a.localeCompare(b, 'en'))));
    const component = { type: item.type || 'library', 'bom-ref': 'vendor:' + item.id,
      name: item.name, version: item.version || 'snapshot-sha256-' + digest,
      licenses: license(item.license), properties: [property('phase', 'runtime'),
        property('source-hash-mode', 'LF text; raw binary'), property('source-set-sha256', digest),
        property('provenance', item.provenance), property('locally-modified', item.modified ? 'true' : 'not-established')] };
    if (item.purl) component.purl = item.purl;
    if (item.coverage) component.properties.push(property('coverage-limitation', item.coverage));
    return { ...item, component };
  });
}

function sourcePackage(resource, installed) {
  const location = resource.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/)?.[1];
  if (!location) return undefined;
  assert.ok(installed.has(location), 'browser source is absent from installed lock: ' + resource);
  return location;
}

function verifyArchive(archive, dist, version, expectedHash) {
  const digest = sha256(fs.readFileSync(archive));
  if (!expectedHash) {
    assert.ok(fs.existsSync(archive + '.sha256'), 'original archive SHA-256 sidecar is required');
    expectedHash = fs.readFileSync(archive + '.sha256', 'utf8').trim().split(/\s+/)[0];
  }
  assert.match(expectedHash, /^[a-f0-9]{64}$/i, 'invalid original archive SHA-256');
  assert.equal(digest, expectedHash.toLowerCase(), 'original archive SHA-256 mismatch');
  const archived = readTar(archive), files = walk(dist);
  const prefix = [...archived.keys()].every(name => name.startsWith(version + '/')) ? version + '/' : '';
  assert.equal(archived.size, files.length, 'archive file set differs from dist');
  const output = files.map(file => {
    const bytes = fs.readFileSync(path.join(dist, file));
    assert.ok(archived.has(prefix + file), 'dist file missing from original archive: ' + file);
    assert.equal(sha256(archived.get(prefix + file)), sha256(bytes), 'archive content differs from dist: ' + file);
    return { path: relative(file), size: bytes.length, sha256: sha256(bytes) };
  });
  return { name: 'web-console-' + version + '.tar.gz', sha256: digest, files: output };
}

function retainedAssetResolver(dist, artifact) {
  const files = new Map(artifact.files.map(file => [file.path, file]));
  const assetMapFile = path.join(dist, 'assets/assetMap.json');
  const assetMap = fs.existsSync(assetMapFile) ? json(assetMapFile).assets : {};
  assert.ok(assetMap && typeof assetMap === 'object' && !Array.isArray(assetMap), 'invalid browser asset map');
  return raw => {
    const name = relative(slash(raw).replace(/^\//, ''));
    const candidates = name.startsWith('assets/') ? [name] : [name, 'assets/' + name];
    const mapped = candidates.filter(candidate => Object.hasOwn(assetMap, candidate))
      .map(candidate => relative(assetMap[candidate]));
    const exact = sort(new Set((mapped.length ? mapped : candidates).filter(candidate => files.has(candidate))));
    assert.ok(exact.length <= 1, 'ambiguous retained browser asset: ' + name);
    if (exact.length) return files.get(exact[0]);
    if (mapped.length) return undefined;
    // Broccoli's standard MD5 filename fingerprint can remain after assetMap
    // is omitted. Match the same directory/stem/extension and exactly 32 hex
    // digits; a loose basename or prefix match could select unrelated code.
    const fingerprints = new Set();
    for (const candidate of candidates) {
      const extension = path.posix.extname(candidate);
      if (!extension) continue;
      const stem = candidate.slice(0, -extension.length);
      const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matcher = new RegExp('^' + escape(stem) + '-[a-f0-9]{32}' + escape(extension) + '$');
      for (const file of files.keys()) if (matcher.test(file)) fingerprints.add(file);
    }
    assert.ok(fingerprints.size <= 1, 'ambiguous fingerprinted browser asset: ' + name);
    return fingerprints.size ? files.get([...fingerprints][0]) : undefined;
  };
}

function verifierClosure(root, options) {
  if (!options.verifierRoot) return undefined;
  const location = relative(options.verifierRoot), directory = path.join(root, location);
  const manifestBytes = fs.readFileSync(path.join(directory, 'package.json'));
  const lockBytes = fs.readFileSync(path.join(directory, 'package-lock.json'));
  const manifestSha256 = sha256(manifestBytes), lockSha256 = sha256(lockBytes);
  for (const [expected, actual, label] of [[options.verifierManifestSha256, manifestSha256, 'manifest'], [options.verifierLockSha256, lockSha256, 'lock']]) {
    if (expected) {
      assert.match(expected, /^[a-f0-9]{64}$/i, 'invalid verifier ' + label + ' SHA-256');
      assert.equal(actual, expected.toLowerCase(), 'verifier ' + label + ' SHA-256 drift');
    }
  }
  const pkg = JSON.parse(manifestBytes), lock = JSON.parse(lockBytes), lockedRoot = lock.packages?.[''];
  assert.ok(pkg.name && pkg.version && lockedRoot, 'verifier root identity is required');
  assert.equal(lockedRoot.name || lock.name, pkg.name, 'verifier manifest name differs from lock');
  assert.equal(lockedRoot.version, pkg.version, 'verifier manifest version differs from lock');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.deepEqual(pkg[field] || {}, lockedRoot[field] || {}, 'verifier manifest dependencies differ from lock');
  }
  const installed = installedPackages(directory, lock, 'verifier-npm');
  const actualLock = json(path.join(directory, 'node_modules/.package-lock.json'));
  assert.ok(actualLock.lockfileVersion >= 2 && actualLock.packages, 'verifier installed lock is required');
  assert.deepEqual(Object.keys(actualLock.packages).sort(), sort(installed.keys()), 'verifier installed closure differs from frozen lock');
  for (const [name, item] of installed) {
    for (const field of ['version', 'resolved', 'integrity']) {
      assert.equal(actualLock.packages[name][field], item.entry[field], 'verifier installed lock drift: ' + name + ' ' + field);
    }
    item.component.properties.push(property('input-set', 'sbom-verifier'));
  }
  const namespace = 'verifier-npm', toolRef = 'tool:sbom-verifier', direct = new Set();
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })) {
    const target = resolveDependency(installed, '', name);
    assert.ok(target || Object.hasOwn(pkg.optionalDependencies || {}, name), 'missing verifier root installed dependency: ' + name);
    if (target) direct.add(npmRef(target, namespace));
  }
  const component = { type: 'application', 'bom-ref': toolRef, name: pkg.name, version: pkg.version,
    purl: purl(pkg.name, pkg.version), licenses: license(pkg.license),
    properties: [property('phase', 'build'), property('input-set', 'sbom-verifier'),
      property('manifest-sha256', manifestSha256), property('lock-sha256', lockSha256)] };
  return { identity: { root: location, manifestSha256, lockSha256, installedPackages: installed.size }, toolRef,
    components: [component, ...[...installed.values()].map(item => item.component)],
    dependencies: [{ ref: toolRef, dependsOn: sort(direct) }, ...dependencyGraph(installed, lock, new Set(installed.keys()), namespace)] };
}

function generate(options) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const pkg = json(path.join(root, 'package.json'));
  const lockBytes = fs.readFileSync(path.join(root, 'package-lock.json')), lock = JSON.parse(lockBytes);
  assert.equal(lock.packages[''].version, pkg.version, 'root package and lock versions differ');
  const lockHash = sha256(lockBytes);
  const inventoryPath = options.webpackInventory || path.join(root, 'build/security-browser/webpack-modules.json');
  const inventory = json(inventoryPath);
  assert.equal(inventory.schemaVersion, 1, 'unsupported webpack inventory');
  assert.equal(inventory.lockSha256, lockHash, 'webpack inventory lock drift');
  assert.ok(Array.isArray(inventory.modules) && inventory.modules.length > 0, 'webpack inventory is empty');
  assert.ok(inventory.assetModules && typeof inventory.assetModules === 'object' && Object.keys(inventory.assetModules).length,
    'webpack per-asset module inventory is required');
  assert.ok(inventory.assetSHA256 && typeof inventory.assetSHA256 === 'object', 'webpack per-asset SHA-256 inventory is required');
  const concatDirectory = options.concatStats || path.join(root, 'build/security-browser/concat-stats');
  // Only top-level JSON files are concat statistics. The adjacent input trees
  // contain thousands of package.json files that are not statistics.
  const stats = fs.readdirSync(concatDirectory).filter(name => name.endsWith('.json')).sort().map(name => {
    const bytes = fs.readFileSync(path.join(concatDirectory, name)), data = JSON.parse(bytes);
    assert.ok(data.outputFile && data.sizes && Object.keys(data.sizes).length, 'invalid top-level concat inventory');
    return { name, sha256: sha256(bytes), data };
  });
  assert.ok(stats.some(item => /(?:^|\/)vendor\.js$/.test(item.data.outputFile)) &&
    stats.some(item => /(?:^|\/)ui\.js$/.test(item.data.outputFile)), 'application and vendor concat inventories are required');
  const epoch = String(options.epoch ?? process.env.SOURCE_DATE_EPOCH ?? '');
  assert.match(epoch, /^\d+$/, 'SOURCE_DATE_EPOCH is required for deterministic SBOMs');
  const timestamp = new Date(Number(epoch) * 1000).toISOString();
  const commit = options.sourceCommit || process.env.GITHUB_SHA || childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.match(commit, /^[a-f0-9]{40}$/i, 'exact source commit is required');
  const installed = installedPackages(root, lock);
  const allInstalled = new Set(installed.keys());
  const buildEdges = dependencyGraph(installed, lock, allInstalled);
  const verifier = verifierClosure(root, options);
  const manifest = json(options.vendorManifest || path.join(root, 'docs/security/ui-vendor-components.json'));
  for (const [file, digest] of Object.entries(manifest.guards || {})) {
    assert.equal(sourceHash(path.join(root, relative(file))), digest, 'browser import boundary changed without provenance review: ' + file);
  }
  const vendors = vendorComponents(root, manifest);
  const runtime = new Set(), selectedVendors = new Set(), evidence = new Map(), limitations = new Set();
  const addNpm = (location, source) => { runtime.add(location); if (!evidence.has(npmRef(location))) evidence.set(npmRef(location), new Set()); evidence.get(npmRef(location)).add(source); };
  const addVendor = (item, source) => { selectedVendors.add(item); if (!evidence.has(item.component['bom-ref'])) evidence.set(item.component['bom-ref'], new Set()); evidence.get(item.component['bom-ref']).add(source); if (item.coverage) limitations.add(item.coverage); };
  const byName = name => {
    const candidates = [...installed].filter(([, item]) => item.metadata.name === name);
    const top = 'node_modules/' + name;
    if (installed.has(top)) return top;
    assert.equal(candidates.length, 1, 'ambiguous or missing addon package: ' + name);
    return candidates[0][0];
  };
  function mapSource(raw, phase) {
    if (raw === '<generated-or-owned>' && phase === 'webpack') {
      limitations.add('Webpack generated-or-owned sentinel does not identify individual generated source modules.'); return;
    }
    const source = relative(raw);
    const npm = sourcePackage(source, installed);
    if (npm) { addNpm(npm, source); return; }
    const addon = source.match(/^addon-tree-output\/((?:@[^/]+\/)?[^/]+)\//);
    if (addon) { addNpm(byName(addon[1]), source); return; }
    const vendor = vendors.find(item => (item.inputs || []).includes(source));
    if (vendor) { addVendor(vendor, source); return; }
    const generated = manifest.generatedInputs?.[source];
    if (generated) { if (generated !== 'first-party') addNpm(byName(generated), source); return; }
    if (source.startsWith('ui/')) {
      const appPath = source.slice(3);
      if (['app/' + appPath, 'app/' + appPath.replace(/\.js$/, '.hbs')].some(file => fs.existsSync(path.join(root, file)))) return;
      const owners = [...installed.values()].filter(item => {
        const appJs = item.metadata['ember-addon']?.['app-js'] || {};
        const declared = appJs['./' + appPath];
        const files = ['app/' + appPath, 'app/' + appPath.replace(/\.js$/, '.hbs')];
        if (typeof declared === 'string') files.push(relative(declared));
        return files.some(file => fs.existsSync(path.join(root, item.target, file)));
      });
      assert.ok(owners.length > 0, 'unknown application/addon source: ' + source);
      for (const owner of owners) addNpm(owner.location, source);
      if (owners.length > 1) limitations.add('Multiple addon app-tree owners are conservatively included for a shared emitted module.');
      return;
    }
    throw new Error('unknown browser third-party source: ' + source);
  }
  const dist = options.dist || path.join(root, 'dist');
  const artifact = verifyArchive(options.archive, dist, pkg.version, options.archiveSha256);
  const retainedAsset = retainedAssetResolver(dist, artifact), retainedWebpack = [], retainedConcat = [];
  for (const [name, modules] of Object.entries(inventory.assetModules).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    assert.ok(Array.isArray(modules), 'invalid webpack per-asset module list');
    assert.match(inventory.assetSHA256[name] || '', /^[a-f0-9]{64}$/i, 'webpack asset SHA-256 is required');
    const file = retainedAsset(name);
    if (!file) continue;
    assert.equal(file.sha256, inventory.assetSHA256[name].toLowerCase(), 'retained webpack asset SHA-256 mismatch: ' + name);
    retainedWebpack.push({ name, path: file.path, sha256: file.sha256 });
    for (const source of sort(new Set(modules))) mapSource(source, 'webpack');
  }
  assert.ok(retainedWebpack.length > 0, 'no retained webpack assets matched the release');
  for (const item of stats) {
    const file = retainedAsset(item.data.outputFile);
    if (!file) continue;
    retainedConcat.push({ outputFile: item.data.outputFile, path: file.path });
    for (const source of Object.keys(item.data.sizes).sort()) mapSource(source, 'concat');
  }
  assert.ok(retainedConcat.some(item => /(?:^|\/)ui\.js$/.test(item.outputFile)) &&
    retainedConcat.some(item => /(?:^|\/)vendor\.js$/.test(item.outputFile)), 'retained application and vendor concat inventories are required');
  // Styles and copied fonts bypass JavaScript bundlers. Fixed inputs are
  // reviewed and source-hashed, and every copied font must match the archive.
  for (const item of vendors.filter(value => value.style || value.copied)) {
    if (item.style) for (const file of item.style) {
      const source = fs.readFileSync(path.join(root, relative(file)), 'utf8');
      assert.ok(source.length > 0, 'style source missing');
      addVendor(item, file);
    }
    if (item.copied) for (const file of item.copied) {
      const digest = sha256(fs.readFileSync(path.join(root, relative(file))));
      assert.ok(artifact.files.some(output => output.sha256 === digest), 'copied vendor asset missing from release: ' + file);
      addVendor(item, file);
    }
  }
  for (const name of manifest.styleNpm || []) addNpm(byName(name), 'reviewed-sass-input:' + name);
  limitations.add('Sass ownership uses reviewed fixed inputs; compiler dependency tracing is not available.');
  const archiveRef = 'artifact:web-console-' + pkg.version + '.tar.gz';
  const component = { type: 'application', 'bom-ref': archiveRef, name: pkg.name, version: pkg.version,
    purl: purl(pkg.name, pkg.version), hashes: [{ alg: 'SHA-256', content: artifact.sha256 }], licenses: license(pkg.license) };
  const commonProperties = [property('source-commit', commit.toLowerCase()), property('lock-sha256', lockHash),
    property('archive-name', artifact.name), property('archive-sha256', artifact.sha256), property('vulnerability-scan', 'not-performed')];
  const fileComponents = artifact.files.map(file => ({ type: 'file', 'bom-ref': 'file:' + file.path,
    name: file.path, hashes: [{ alg: 'SHA-256', content: file.sha256 }] }));
  const runtimeComponents = [...sort(runtime).map(location => {
    const c = structuredClone(installed.get(location).component);
    c.properties = c.properties.filter(item => item.name !== 'pasturestack:phase');
    c.properties.push(property('phase', 'runtime')); return c;
  }), ...[...selectedVendors].map(item => structuredClone(item.component))];
  for (const c of runtimeComponents) c.properties.push(property('observed-sources', JSON.stringify(sort(evidence.get(c['bom-ref']) || []))));
  const base = (phase, components, dependencies) => ({ bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
    metadata: { timestamp, component: structuredClone(component), properties: [...commonProperties, property('phase', phase)] },
    components: components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'], 'en')),
    dependencies: dependencies.sort((a, b) => a.ref.localeCompare(b.ref, 'en')) });
  const runtimeEdges = dependencyGraph(installed, lock, runtime);
  for (const vendor of selectedVendors) runtimeEdges.push({ ref: vendor.component['bom-ref'], dependsOn: [] });
  for (const file of fileComponents) runtimeEdges.push({ ref: file['bom-ref'], dependsOn: [] });
  runtimeEdges.push({ ref: archiveRef, dependsOn: sort([...runtimeComponents, ...fileComponents].map(item => item['bom-ref'])) });
  const runtimeBom = base('runtime', [...runtimeComponents, ...fileComponents], runtimeEdges);
  runtimeBom.metadata.properties.push(property('coverage', 'incomplete'), property('coverage-limitations', JSON.stringify(sort(limitations))));
  runtimeBom.compositions = [{ aggregate: 'incomplete', assemblies: [archiveRef] }];
  const buildRoot = lock.packages[''], buildDirect = new Set();
  for (const name of Object.keys({ ...buildRoot.dependencies, ...buildRoot.devDependencies, ...buildRoot.optionalDependencies })) {
    const location = resolveDependency(installed, '', name);
    assert.ok(location || Object.hasOwn(buildRoot.optionalDependencies || {}, name), 'missing root installed dependency: ' + name);
    if (location) buildDirect.add(npmRef(location));
  }
  const buildBom = base('build', [...installed.values()].map(item => item.component),
    [{ ref: archiveRef, dependsOn: sort(buildDirect) }, ...buildEdges]);
  if (verifier) {
    buildBom.components.push(...verifier.components);
    buildBom.dependencies.find(item => item.ref === archiveRef).dependsOn.push(verifier.toolRef);
    buildBom.dependencies.push(...verifier.dependencies);
    buildBom.metadata.properties.push(property('verifier-root', verifier.identity.root),
      property('verifier-manifest-sha256', verifier.identity.manifestSha256), property('verifier-lock-sha256', verifier.identity.lockSha256));
    buildBom.components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'], 'en'));
    buildBom.dependencies.sort((a, b) => a.ref.localeCompare(b.ref, 'en'));
  }
  buildBom.metadata.properties.push(property('coverage', 'installed-npm-closure-including-dev'),
    property('coverage-limitations', 'npm installed closure only; operating system, Node.js, npm and external CI actions are not inventoried.' +
      (verifier ? ' The separate release schema verifier installed closure is included.' : ' External schema verifier tools are not included because --verifier-root was not provided.')));
  buildBom.compositions = [{ aggregate: 'incomplete', assemblies: [archiveRef] }];
  const artifactManifest = { schemaVersion: 1, name: pkg.name, version: pkg.version, sourceCommit: commit.toLowerCase(),
    sourceDateEpoch: Number(epoch), lockSha256: lockHash, archive: { name: artifact.name, sha256: artifact.sha256 },
    inventory: { webpackSha256: sha256(fs.readFileSync(inventoryPath)), retainedWebpack, retainedConcat,
      concat: stats.map(({ name, sha256: digest }) => ({ name, sha256: digest })) },
    files: artifact.files, coverage: 'incomplete', limitations: sort(limitations) };
  if (verifier) artifactManifest.buildInputs = { verifier: verifier.identity };
  const result = { 'runtime.cdx.json': runtimeBom, 'build.cdx.json': buildBom, 'artifact-manifest.json': artifactManifest };
  for (const document of Object.values(result)) {
    const encoded = JSON.stringify(document);
    assert.ok(!/[A-Za-z]:[\\/]|\/home\/|\/Users\/|\/runner\/|https?:\/\/[^\s"/@]+:[^\s"/@]+@/.test(encoded), 'private builder path or userinfo in SBOM');
  }
  return result;
}

function main(args) {
  const options = {};
  const names = { '--dist': 'dist', '--archive': 'archive', '--archive-sha256': 'archiveSha256',
    '--webpack-inventory': 'webpackInventory', '--concat-stats': 'concatStats', '--output-dir': 'outputDir', '--source-commit': 'sourceCommit',
    '--verifier-root': 'verifierRoot', '--verifier-manifest-sha256': 'verifierManifestSha256', '--verifier-lock-sha256': 'verifierLockSha256' };
  for (let i = 0; i < args.length; i += 2) { assert.ok(names[args[i]] && args[i + 1], 'unknown or incomplete SBOM argument'); options[names[args[i]]] = args[i + 1]; }
  assert.ok(options.archive && options.outputDir, '--archive and --output-dir are required');
  const output = path.resolve(options.outputDir), dist = path.resolve(options.dist || 'dist');
  assert.ok(output !== dist && !output.startsWith(dist + path.sep), 'SBOM output must be outside browser dist');
  const documents = generate(options);
  fs.mkdirSync(output, { recursive: true });
  for (const [name, document] of Object.entries(documents)) fs.writeFileSync(path.join(output, name), JSON.stringify(document, null, 2) + '\n');
  console.log(JSON.stringify({ outcome: 'PASS_UI_ARTIFACT_SBOM', runtimeComponents: documents['runtime.cdx.json'].components.length,
    buildComponents: documents['build.cdx.json'].components.length, coverage: 'incomplete', archiveSha256: documents['artifact-manifest.json'].archive.sha256 }));
}

module.exports = { generate, readTar, sourceHash, sourcePackage, purl, installedPackages, dependencyGraph, verifyArchive };
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('UI_SBOM_FAILED: ' + error.message); process.exitCode = 1; }
}
