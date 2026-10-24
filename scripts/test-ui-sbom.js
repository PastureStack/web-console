'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { generate, sourceHash } = require('./generate-ui-sbom');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceCommit = '0123456789abcdef0123456789abcdef01234567';
let checks = 0;

function write(root, name, value) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value, null, 2) + '\n' : value);
}

// Independent tiny USTAR writer: the tests do not use the reader under test to
// construct or verify their archive contents.
function archive(root, files, name = 'original.tar.gz') {
  const parts = [];
  for (const [file, bytes] of Object.entries(files)) {
    const data = Buffer.from(bytes), header = Buffer.alloc(512);
    header.write('1.0.0/' + file, 0, 100);
    for (const [offset, length, value] of [[100, 8, 420], [108, 8, 0], [116, 8, 0], [124, 12, data.length], [136, 12, 1]]) {
      header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length);
    }
    header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
    const checksum = [...header].reduce((sum, value) => sum + value, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    parts.push(header, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  const file = path.join(root, name);
  fs.writeFileSync(file, zlib.gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]), { mtime: 0 }));
  fs.writeFileSync(file + '.sha256', digest(fs.readFileSync(file)) + '  ' + name + '\n');
  return file;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pasturestack-ui-sbom-'));
  const pkg = { name: '@pasturestack/web-console', version: '1.0.0', license: 'Apache-2.0',
    devDependencies: { '@scope/runtime': '2.0.0', 'build-only': '3.0.0', alias: 'npm:@scope/real@4.0.0', demo: 'file:vendor/demo' } };
  const packages = { '': pkg,
    'node_modules/@scope/runtime': { version: '2.0.0', dev: true, license: 'MIT', dependencies: { nested: '2.0.0' } },
    'node_modules/@scope/runtime/node_modules/nested': { version: '2.0.0', dev: true, license: 'MIT' },
    'node_modules/nested': { version: '1.0.0', dev: true, license: 'MIT' },
    'node_modules/build-only': { version: '3.0.0', dev: true, license: 'ISC', dependencies: { nested: '1.0.0' } },
    'node_modules/alias': { name: '@scope/real', version: '4.0.0', dev: true, license: '(MIT OR Apache-2.0)' },
    'node_modules/demo': { link: true, resolved: 'vendor/demo' },
    'vendor/demo': { version: '1.0.0-local.1', dev: true, license: 'MIT' },
    'node_modules/platform-optional': { version: '1.0.0', optional: true } };
  write(root, 'package.json', pkg);
  write(root, 'package-lock.json', { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages });
  for (const [location, entry] of Object.entries(packages)) {
    if (!location || entry.link || entry.optional) continue;
    const name = location === 'vendor/demo' ? 'demo' : entry.name || location.split('node_modules/').at(-1);
    write(root, location + '/package.json', { name, version: entry.version, license: entry.license,
      ...(name === 'demo' ? { rc16Maintenance: { source: 'demo@1.0.0', reason: 'retained local compatibility patch' } } : {}) });
  }
  fs.symlinkSync(path.join(root, 'vendor/demo'), path.join(root, 'node_modules/demo'), process.platform === 'win32' ? 'junction' : 'dir');
  write(root, 'app/owned.js', '// owned\n');
  write(root, 'vendor/pinned.js', '// fixed upstream\n');
  write(root, 'vendor/font.woff2', Buffer.from([0, 2, 4, 6]));
  write(root, 'ember-cli-build.js', '// reviewed import boundary\n');
  const manifest = { schemaVersion: 1, guards: { 'ember-cli-build.js': sourceHash(path.join(root, 'ember-cli-build.js')) },
    generatedInputs: {}, styleNpm: [], components: [
      { id: 'pinned', name: 'pinned', version: '2.0.0', purl: 'pkg:npm/pinned@2.0.0', license: 'MIT',
        provenance: 'Reviewed test fixture upstream source.', inputs: ['vendor/pinned.js'],
        files: { 'vendor/pinned.js': sourceHash(path.join(root, 'vendor/pinned.js')) } },
      { id: 'font', name: 'reviewed font', type: 'data', copied: ['vendor/font.woff2'],
        provenance: 'Version is unknown; source-set snapshot is used.', coverage: 'Font upstream version is not established.',
        files: { 'vendor/font.woff2': sourceHash(path.join(root, 'vendor/font.woff2')) } }
    ] };
  write(root, 'docs/security/ui-vendor-components.json', manifest);
  const webpack = { schemaVersion: 1, lockSha256: digest(fs.readFileSync(path.join(root, 'package-lock.json'))),
    modules: ['<generated-or-owned>', 'node_modules/@scope/runtime/index.js',
      'node_modules/@scope/runtime/node_modules/nested/index.js', 'node_modules/alias/index.js'] };
  webpack.assetModules = { 'runtime.js': webpack.modules };
  webpack.assetSHA256 = { 'runtime.js': digest('retained webpack runtime') };
  write(root, 'build/security-browser/webpack-modules.json', webpack);
  write(root, 'build/security-browser/concat-stats/1-ui.js.json', { outputFile: '/assets/ui.js', sizes: { 'ui/owned.js': 10, 'addon-tree-output/demo/index.js': 5 } });
  write(root, 'build/security-browser/concat-stats/2-vendor.js.json', { outputFile: '/assets/vendor.js', sizes: { 'vendor/pinned.js': 10 } });
  // The real concat archive includes nested source package metadata. It must
  // never be parsed as a concat statistics document.
  write(root, 'build/security-browser/concat-stats/1-ui.js/node_modules/not-stats/package.json', { invalidStats: true });
  const files = { 'assets/ui.js': 'application', 'assets/vendor.js': 'vendor',
    'assets/runtime.js': 'retained webpack runtime', 'assets/font.woff2': Buffer.from([0, 2, 4, 6]) };
  for (const [name, bytes] of Object.entries(files)) write(root, 'dist/' + name, bytes);
  const options = { root, dist: path.join(root, 'dist'), archive: archive(root, files), epoch: '1700000000', sourceCommit };
  return { root, options, webpack, files, manifest };
}

function addVerifier(f) {
  const root = 'tools/sbom-verifier';
  const pkg = { name: '@pasturestack/sbom-schema-verifier', version: '1.0.0', private: true, dependencies: { ajv: '8.20.0' } };
  const packages = { '': pkg,
    'node_modules/ajv': { version: '8.20.0', license: 'MIT', resolved: 'https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz',
      integrity: 'sha512-dGVzdA==', dependencies: { nested: '7.0.0' } },
    'node_modules/nested': { version: '7.0.0', license: 'MIT', resolved: 'https://registry.npmjs.org/nested/-/nested-7.0.0.tgz', integrity: 'sha512-dGVzdA==' } };
  write(f.root, root + '/package.json', pkg);
  write(f.root, root + '/package-lock.json', { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages });
  const installed = Object.fromEntries(Object.entries(packages).filter(([name]) => name));
  write(f.root, root + '/node_modules/.package-lock.json', { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: installed });
  for (const [location, entry] of Object.entries(installed)) {
    write(f.root, root + '/' + location + '/package.json', { name: location.slice('node_modules/'.length), version: entry.version, license: entry.license });
  }
  Object.assign(f.options, { verifierRoot: root,
    verifierManifestSha256: digest(fs.readFileSync(path.join(f.root, root, 'package.json'))),
    verifierLockSha256: digest(fs.readFileSync(path.join(f.root, root, 'package-lock.json'))) });
}

function renameArtifact(f, original, replacement) {
  f.files[replacement] = f.files[original]; delete f.files[original];
  fs.renameSync(path.join(f.root, 'dist', original), path.join(f.root, 'dist', replacement));
}

function repack(f) { f.options.archive = archive(f.root, f.files); }

function test(name, run) {
  const f = fixture();
  try { run(f); checks++; console.log('PASS ' + name); }
  finally {
    assert.ok(path.basename(f.root).startsWith('pasturestack-ui-sbom-') && path.dirname(f.root) === os.tmpdir());
    fs.rmSync(f.root, { recursive: true, force: true });
  }
}

function checkGraph(bom) {
  const refs = [bom.metadata.component['bom-ref'], ...bom.components.map(item => item['bom-ref'])];
  assert.equal(new Set(refs).size, refs.length, 'bom-refs must be unique');
  for (const edge of bom.dependencies) {
    assert.ok(refs.includes(edge.ref));
    for (const target of edge.dependsOn) assert.ok(refs.includes(target), 'dangling dependency');
  }
}

test('runtime uses observed npm including dev, nested namespace, alias, vendor and font', f => {
  const output = generate(f.options), runtime = output['runtime.cdx.json'], build = output['build.cdx.json'];
  const npm = runtime.components.filter(c => c['bom-ref'].startsWith('npm:'));
  assert.equal(npm.length, 4);
  assert.ok(npm.some(c => c.purl === 'pkg:npm/%40scope/runtime@2.0.0'));
  assert.ok(npm.some(c => c.purl === 'pkg:npm/%40scope/real@4.0.0'));
  assert.ok(npm.some(c => c['bom-ref'] === 'npm:node_modules/@scope/runtime/node_modules/nested'));
  assert.ok(!npm.some(c => c.name === 'build-only' || c.version === '1.0.0'));
  assert.ok(build.components.some(c => c.name === 'build-only'));
  assert.ok(runtime.components.some(c => c['bom-ref'] === 'vendor:pinned'));
  assert.ok(runtime.components.some(c => c['bom-ref'] === 'vendor:font' && c.version.startsWith('snapshot-sha256-')));
  assert.ok(npm.find(c => c.name === 'demo').properties.some(p => p.name === 'pasturestack:local-patch'));
  assert.equal(runtime.compositions[0].aggregate, 'incomplete');
  assert.equal(runtime.metadata.component.hashes[0].content, digest(fs.readFileSync(f.options.archive)));
  assert.equal(runtime.metadata.timestamp, '2023-11-14T22:13:20.000Z');
  assert.ok(runtime.dependencies.find(e => e.ref === 'npm:node_modules/@scope/runtime').dependsOn.includes('npm:node_modules/@scope/runtime/node_modules/nested'));
  checkGraph(runtime); checkGraph(build);
  const encoded = JSON.stringify(output);
  assert.ok(!encoded.includes(f.root) && !encoded.includes(os.userInfo().username + path.sep));
});

test('deterministic and independent of temporary archive path', f => {
  const first = generate(f.options), secondArchive = archive(f.root, f.files, 'different-temporary-name.tar.gz');
  assert.deepEqual(generate({ ...f.options, archive: secondArchive }), first);
  assert.deepEqual(generate(f.options), first);
  assert.equal(first['artifact-manifest.json'].archive.name, 'web-console-1.0.0.tar.gz');
});

test('verifier closure has its own namespace and root edges and never changes runtime', f => {
  const original = generate(f.options)['runtime.cdx.json'];
  addVerifier(f);
  const output = generate(f.options), build = output['build.cdx.json'];
  assert.deepEqual(output['runtime.cdx.json'], original);
  const closure = build.components.filter(item => item['bom-ref'].startsWith('verifier-npm:'));
  assert.equal(closure.length, 2);
  assert.ok(closure.some(item => item.name === 'ajv' && item.version === '8.20.0'));
  assert.ok(closure.some(item => item.name === 'nested' && item.version === '7.0.0'));
  assert.ok(build.components.some(item => item['bom-ref'] === 'npm:node_modules/nested' && item.version === '1.0.0'));
  assert.deepEqual(build.dependencies.find(item => item.ref === 'tool:sbom-verifier').dependsOn, ['verifier-npm:node_modules/ajv']);
  assert.deepEqual(build.dependencies.find(item => item.ref === 'verifier-npm:node_modules/ajv').dependsOn, ['verifier-npm:node_modules/nested']);
  assert.ok(build.dependencies.find(item => item.ref === build.metadata.component['bom-ref']).dependsOn.includes('tool:sbom-verifier'));
  assert.ok(build.metadata.properties.some(item => item.name === 'pasturestack:verifier-lock-sha256' && item.value === f.options.verifierLockSha256));
  assert.deepEqual(output['artifact-manifest.json'].buildInputs.verifier, {
    root: f.options.verifierRoot, manifestSha256: f.options.verifierManifestSha256,
    lockSha256: f.options.verifierLockSha256, installedPackages: 2,
  });
  assert.deepEqual(generate(f.options), output);
  assert.ok(!JSON.stringify(output).includes(f.root));
  checkGraph(build);
});
test('omitted verifier root explicitly limits build coverage', f => {
  const build = generate(f.options)['build.cdx.json'];
  assert.ok(build.metadata.properties.some(item => item.name === 'pasturestack:coverage-limitations' && item.value.includes('--verifier-root was not provided')));
});
test('missing verifier installation fails', f => {
  addVerifier(f); fs.unlinkSync(path.join(f.root, f.options.verifierRoot, 'node_modules/ajv/package.json'));
  assert.throws(() => generate(f.options), /installed lock package is missing/);
});
test('verifier frozen lock byte drift fails', f => {
  addVerifier(f); fs.appendFileSync(path.join(f.root, f.options.verifierRoot, 'package-lock.json'), '\n');
  assert.throws(() => generate(f.options), /verifier lock SHA-256 drift/);
});
test('verifier manifest tamper fails', f => {
  addVerifier(f); fs.appendFileSync(path.join(f.root, f.options.verifierRoot, 'package.json'), '\n');
  assert.throws(() => generate(f.options), /verifier manifest SHA-256 drift/);
});
test('verifier installed lock tamper fails even when source locks are unchanged', f => {
  addVerifier(f);
  const file = path.join(f.root, f.options.verifierRoot, 'node_modules/.package-lock.json'), installed = JSON.parse(fs.readFileSync(file, 'utf8'));
  installed.packages['node_modules/ajv'].integrity = 'sha512-dGFtcGVy';
  write(f.root, f.options.verifierRoot + '/node_modules/.package-lock.json', installed);
  assert.throws(() => generate(f.options), /verifier installed lock drift/);
});
test('missing verifier install evidence fails', f => {
  addVerifier(f); fs.unlinkSync(path.join(f.root, f.options.verifierRoot, 'node_modules/.package-lock.json'));
  assert.throws(() => generate(f.options), /ENOENT/);
});

test('removed webpack chunks and concat outputs do not enter browser runtime', f => {
  f.webpack.assetModules['runtime.js'] = [...f.webpack.modules];
  f.webpack.modules.push('node_modules/build-only/index.js');
  f.webpack.assetModules['test-only.js'] = ['node_modules/build-only/index.js'];
  f.webpack.assetSHA256['test-only.js'] = digest('removed test chunk');
  write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  write(f.root, 'build/security-browser/concat-stats/3-test-only.js.json', { outputFile: '/assets/test-only.js', sizes: { 'node_modules/build-only/index.js': 1 } });
  const output = generate(f.options);
  assert.ok(!output['runtime.cdx.json'].components.some(item => item.name === 'build-only'));
  assert.ok(output['build.cdx.json'].components.some(item => item.name === 'build-only'));
  assert.equal(output['artifact-manifest.json'].inventory.retainedWebpack.length, 1);
  assert.equal(output['artifact-manifest.json'].inventory.retainedConcat.length, 2);
});
test('webpack per-asset inventory is mandatory', f => {
  delete f.webpack.assetModules; write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  assert.throws(() => generate(f.options), /per-asset module inventory is required/);
});
test('retained webpack bytes must match emitted asset evidence', f => {
  f.webpack.assetSHA256['runtime.js'] = '0'.repeat(64); write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  assert.throws(() => generate(f.options), /retained webpack asset SHA-256 mismatch/);
});
test('asset map resolves retained webpack and concat fingerprint names', f => {
  renameArtifact(f, 'assets/runtime.js', 'assets/runtime-mapped.js');
  renameArtifact(f, 'assets/ui.js', 'assets/ui-mapped.js');
  const map = { assets: { 'assets/runtime.js': 'assets/runtime-mapped.js', 'assets/ui.js': 'assets/ui-mapped.js' } };
  f.files['assets/assetMap.json'] = JSON.stringify(map); write(f.root, 'dist/assets/assetMap.json', f.files['assets/assetMap.json']); repack(f);
  const manifest = generate(f.options)['artifact-manifest.json'];
  assert.equal(manifest.inventory.retainedWebpack[0].path, 'assets/runtime-mapped.js');
  assert.ok(manifest.inventory.retainedConcat.some(item => item.path === 'assets/ui-mapped.js'));
});
test('unique standard 32-hex fingerprint fallback handles absent asset map', f => {
  renameArtifact(f, 'assets/runtime.js', 'assets/runtime-' + 'a'.repeat(32) + '.js');
  renameArtifact(f, 'assets/ui.js', 'assets/ui-' + 'b'.repeat(32) + '.js'); repack(f);
  assert.equal(generate(f.options)['artifact-manifest.json'].inventory.retainedWebpack[0].path, 'assets/runtime-' + 'a'.repeat(32) + '.js');
});
test('ambiguous standard fingerprints fail closed', f => {
  renameArtifact(f, 'assets/runtime.js', 'assets/runtime-' + 'a'.repeat(32) + '.js');
  f.files['assets/runtime-' + 'b'.repeat(32) + '.js'] = 'retained webpack runtime';
  write(f.root, 'dist/assets/runtime-' + 'b'.repeat(32) + '.js', 'retained webpack runtime'); repack(f);
  assert.throws(() => generate(f.options), /ambiguous fingerprinted browser asset/);
});
test('loose basename or nonstandard hash does not select unrelated assets', f => {
  renameArtifact(f, 'assets/runtime.js', 'assets/runtime-almost.js'); repack(f);
  assert.throws(() => generate(f.options), /no retained webpack assets/);
});

test('Ember v2 app-js declarations identify emitted reexports', f => {
  const file = path.join(f.root, 'node_modules/@scope/runtime/package.json');
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  metadata['ember-addon'] = { version: 2, 'app-js': { './helpers/reexport.js': './dist/_app_/helpers/reexport.js' } };
  write(f.root, 'node_modules/@scope/runtime/package.json', metadata);
  write(f.root, 'node_modules/@scope/runtime/dist/_app_/helpers/reexport.js', 'export default runtime;');
  write(f.root, 'build/security-browser/concat-stats/1-ui.js.json', { outputFile: '/assets/ui.js', sizes: { 'ui/helpers/reexport.js': 1 } });
  const component = generate(f.options)['runtime.cdx.json'].components.find(item => item.name === '@scope/runtime');
  assert.ok(component.properties.some(item => item.value.includes('ui/helpers/reexport.js')));
});

test('linked local package dependencies resolve from physical vendor directory', f => {
  const file = path.join(f.root, 'package-lock.json'), lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  lock.packages['vendor/demo'].dependencies = { nested: '8.0.0' };
  lock.packages['vendor/demo/node_modules/nested'] = { version: '8.0.0', dev: true, license: 'MIT' };
  write(f.root, 'package-lock.json', lock);
  write(f.root, 'vendor/demo/node_modules/nested/package.json', { name: 'nested', version: '8.0.0', license: 'MIT' });
  f.webpack.lockSha256 = digest(fs.readFileSync(file));
  write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  const bom = generate(f.options)['build.cdx.json'];
  assert.deepEqual(bom.dependencies.find(item => item.ref === 'npm:node_modules/demo').dependsOn, ['npm:vendor/demo/node_modules/nested']);
  checkGraph(bom);
});

test('missing webpack inventory fails', f => {
  fs.unlinkSync(path.join(f.root, 'build/security-browser/webpack-modules.json'));
  assert.throws(() => generate(f.options), /ENOENT/);
});
test('missing concat inventory fails', f => {
  fs.unlinkSync(path.join(f.root, 'build/security-browser/concat-stats/2-vendor.js.json'));
  assert.throws(() => generate(f.options), /application and vendor/);
});
test('lock drift fails', f => {
  fs.appendFileSync(path.join(f.root, 'package-lock.json'), '\n');
  assert.throws(() => generate(f.options), /lock drift/);
});
test('unknown third-party inventory source fails closed', f => {
  f.webpack.modules.push('vendor/unreviewed.js'); write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  assert.throws(() => generate(f.options), /unknown browser third-party/);
});
test('unmapped emitted addon module fails closed', f => {
  write(f.root, 'build/security-browser/concat-stats/1-ui.js.json', { outputFile: '/assets/ui.js', sizes: { 'ui/unknown.js': 1 } });
  assert.throws(() => generate(f.options), /unknown application\/addon/);
});
test('nested npm identity must exist in actual installed closure', f => {
  f.webpack.modules.push('node_modules/@scope/runtime/node_modules/unreviewed/index.js');
  write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  assert.throws(() => generate(f.options), /absent from installed lock/);
});
test('installed version drift fails', f => {
  write(f.root, 'node_modules/@scope/runtime/package.json', { name: '@scope/runtime', version: '99.0.0' });
  assert.throws(() => generate(f.options), /version differs from lock/);
});
test('installed identity drift fails', f => {
  write(f.root, 'node_modules/@scope/runtime/package.json', { name: '@scope/impersonated', version: '2.0.0' });
  assert.throws(() => generate(f.options), /name differs from lock/);
});
test('missing nonoptional installation fails', f => {
  fs.unlinkSync(path.join(f.root, 'node_modules/build-only/package.json'));
  assert.throws(() => generate(f.options), /installed lock package is missing/);
});
test('missing npm local link is not mistaken for an installation', f => {
  fs.unlinkSync(path.join(f.root, 'node_modules/demo'));
  assert.throws(() => generate(f.options), /installed lock package is missing/);
});
test('vendored source tamper fails', f => {
  fs.appendFileSync(path.join(f.root, 'vendor/pinned.js'), '// changed\n');
  assert.throws(() => generate(f.options), /vendored source changed/);
});
test('import boundary drift requires provenance review', f => {
  fs.appendFileSync(path.join(f.root, 'ember-cli-build.js'), '// new import\n');
  assert.throws(() => generate(f.options), /import boundary changed/);
});
test('original archive tamper fails before content trust', f => {
  fs.appendFileSync(f.options.archive, 'tamper');
  assert.throws(() => generate(f.options), /archive SHA-256 mismatch/);
});
test('archive and browser dist must have identical file bytes', f => {
  write(f.root, 'dist/assets/ui.js', 'tampered browser');
  assert.throws(() => generate(f.options), /archive content differs/);
});
test('missing original archive hash fails', f => {
  fs.unlinkSync(f.options.archive + '.sha256');
  assert.throws(() => generate(f.options), /SHA-256 sidecar is required/);
});
test('absolute paths and traversal are rejected', f => {
  f.webpack.modules.push('C:/Users/private/node_modules/secret/index.js');
  write(f.root, 'build/security-browser/webpack-modules.json', f.webpack);
  assert.throws(() => generate(f.options), /unsafe inventory path/);
});
test('private local metadata and credential-bearing URLs never reach output', f => {
  const file = path.join(f.root, 'vendor/demo/package.json'), metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  metadata.rc16Maintenance.source = 'https://user:secret@example.invalid/repository';
  write(f.root, 'vendor/demo/package.json', metadata);
  assert.throws(() => generate(f.options), /private builder path or userinfo/);
});
test('source tree, browser bytes and original archive are unchanged', f => {
  const before = [f.options.archive, path.join(f.root, 'dist/assets/ui.js'), path.join(f.root, 'vendor/pinned.js')]
    .map(file => [file, digest(fs.readFileSync(file))]);
  generate(f.options);
  for (const [file, hash] of before) assert.equal(digest(fs.readFileSync(file)), hash);
});
test('deterministic time must be explicitly set', f => {
  assert.throws(() => generate({ ...f.options, epoch: '' }), /SOURCE_DATE_EPOCH/);
});
test('CRLF source checkout preserves reviewed text hashes', f => {
  fs.writeFileSync(path.join(f.root, 'vendor/pinned.js'), '// fixed upstream\r\n');
  assert.ok(generate(f.options));
});

// Optional official-schema validation can be enabled without downloading
test('public HTTPS provenance is not mistaken for an absolute Windows drive path', f => {
  const file = path.join(f.root, 'vendor/demo/package.json');
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  metadata.rc16Maintenance.source = 'https://github.com/PastureStack/web-console';
  write(f.root, 'vendor/demo/package.json', metadata);
  const output = generate(f.options);
  const component = output['build.cdx.json'].components.find(item => item.name === 'demo');
  const patch = component.properties.find(item => item.name === 'pasturestack:local-patch');
  assert.equal(JSON.parse(patch.value).source, metadata.rc16Maintenance.source);
});

// Optional official-schema validation can be enabled without downloading
// anything in normal tests: node scripts/test-ui-sbom.js --schema <bom-1.6.schema.json>.
const schemaIndex = process.argv.indexOf('--schema');
if (schemaIndex >= 0) {
  test('CycloneDX 1.6 official schema', f => {
    addVerifier(f);
    const Ajv = require('ajv'), schema = JSON.parse(fs.readFileSync(process.argv[schemaIndex + 1], 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
    for (const name of ['spdx.schema.json', 'jsf-0.82.schema.json']) {
      const schemaFile = path.join(path.dirname(process.argv[schemaIndex + 1]), name);
      if (fs.existsSync(schemaFile)) ajv.addSchema(JSON.parse(fs.readFileSync(schemaFile, 'utf8')));
    }
    const validate = ajv.compile(schema), output = generate(f.options);
    for (const name of ['runtime.cdx.json', 'build.cdx.json']) assert.ok(validate(output[name]), name + ': ' + JSON.stringify(validate.errors));
  });
}
console.log(JSON.stringify({ outcome: 'PASS_UI_SBOM_TESTS', checks }));
