#!/usr/bin/env node
'use strict';
// Explicit source-build preparation after npm ci. Never a loader/runtime hook.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ARCHIVE = 'vendor/minimatch-security-backport/minimatch-10.2.6-pasturestack.1.tgz';
const ARCHIVE_SHA = '7f503bfe66c1dc9bef69b3a42ff29438b54397ee801c5fd1af5e62fe61e28c00';
const INTEGRITY = 'sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==';
const RESOLVED = 'https://registry.npmjs.org/minimatch/-/minimatch-10.2.6.tgz';
const PACKAGE_SHA = 'bb847ba240909c9a36d4eaeb4e0efdc3e31182aeef208c1611259a48f282ea75';
const ORIGINAL = Object.freeze({
  'dist/commonjs/index.js': 'd224f71f20d7c206fcc5b7e9f747324c7698345a0b2c28d717dd9cf698306783',
  'dist/esm/index.js': '59821ec2ce0d3df968292036e5c831ad322b33e9c33a949ecbc9dfe125d165be',
  'dist/commonjs/index.d.ts': '4a3fbf9bb0ebcae246f172ba1f5df33404a4dc0fde03a5241434889b1ca595a5',
  'dist/esm/index.d.ts': '4a3fbf9bb0ebcae246f172ba1f5df33404a4dc0fde03a5241434889b1ca595a5',
});
const MAPS = Object.freeze({
  'dist/commonjs/index.js.map': '4345abdf627c9208d8c34f654a03a3ee3378a10c5241c7e434f8048db21b8240',
  'dist/esm/index.js.map': '5c3e65c473cad1e082a2bcf0c8d40c63d4b72efe239906380515b33a5023a384',
  'dist/commonjs/index.d.ts.map': '17bddd11b7c36d9588648943fc18fc17578d09226b14db02b4a12fb74178f1d1',
  'dist/esm/index.d.ts.map': '17bddd11b7c36d9588648943fc18fc17578d09226b14db02b4a12fb74178f1d1',
});
const ADDED = ['src/index.ts', 'backport.json', 'BACKPORT.md'];
const DEPLOY = [...Object.keys(ORIGINAL), ...ADDED];
const need = (ok, code) => { if (!ok) throw Error(code); };
const sha = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const zero = (raw) => raw.every((byte) => byte === 0);

function text(raw) {
  const end = raw.indexOf(0), size = end < 0 ? raw.length : end;
  need(end < 0 || zero(raw.subarray(end)), 'USTAR_STRING_PADDING_REQUIRED');
  need(raw.subarray(0, size).every((byte) => byte >= 32 && byte <= 126), 'USTAR_ASCII_REQUIRED');
  return raw.subarray(0, size).toString('ascii');
}

function octal(raw) {
  const value = raw.toString('ascii').replace(/[\0 ]+$/g, '').replace(/^ +/g, '');
  need(/^[0-7]+$/.test(value), 'USTAR_OCTAL_REQUIRED');
  const number = Number.parseInt(value, 8);
  need(Number.isSafeInteger(number) && number >= 0, 'USTAR_BOUNDED_INTEGER_REQUIRED');
  return number;
}

function parseTar(raw) {
  need(raw.length <= 2 * 1024 * 1024 && raw.length % 512 === 0, 'BOUNDED_USTAR_REQUIRED');
  const files = new Map(); let offset = 0, ended = false;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    if (zero(header)) {
      need(offset + 1024 <= raw.length && zero(raw.subarray(offset)), 'USTAR_TWO_ZERO_BLOCKS_REQUIRED');
      ended = true; break;
    }
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    need(checksum === octal(header.subarray(148, 156)), 'USTAR_CHECKSUM_REQUIRED');
    need(header.subarray(257, 263).equals(Buffer.from('ustar\0')) && header.subarray(263, 265).toString() === '00'
      && header[156] === 48 && zero(header.subarray(157, 257)) && zero(header.subarray(345, 500)), 'REGULAR_USTAR_ONLY');
    const full = text(header.subarray(0, 100));
    need(/^package\/[A-Za-z0-9_./-]+$/.test(full) && !full.split('/').some((part) => !part || part === '.' || part === '..'), 'USTAR_PACKAGE_PATH_REQUIRED');
    const name = full.slice(8), size = octal(header.subarray(124, 136)), end = offset + 512 + size;
    need(size <= 1024 * 1024 && end <= raw.length && !files.has(name), 'UNIQUE_BOUNDED_USTAR_FILE_REQUIRED');
    files.set(name, raw.subarray(offset + 512, end));
    const next = Math.ceil(end / 512) * 512;
    need(zero(raw.subarray(end, next)), 'USTAR_FILE_PADDING_REQUIRED'); offset = next;
  }
  need(ended, 'USTAR_END_REQUIRED');
  return files;
}

function stat(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safePath(root, relative, allowMissing = false) {
  need(typeof relative === 'string' && relative && !relative.includes('\\') && !relative.includes(':')
    && !relative.split('/').some((part) => !part || part === '.' || part === '..'), 'CLOSED_RELATIVE_PATH_REQUIRED');
  const parts = relative.split('/'); let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]); const info = stat(current);
    if (!info) { need(allowMissing, 'REQUIRED_BUILD_INPUT_MISSING'); continue; }
    need(!info.isSymbolicLink() && (i === parts.length - 1 || info.isDirectory()), 'NO_SYMLINK_BUILD_INPUTS');
  }
  need(path.relative(root, current) && !path.relative(root, current).startsWith('..') && !path.isAbsolute(path.relative(root, current)), 'PROJECT_PATH_BOUNDARY_REQUIRED');
  return current;
}

function regular(root, relative) {
  const file = safePath(root, relative); need(stat(file).isFile(), 'REGULAR_BUILD_FILE_REQUIRED');
  return fs.readFileSync(file);
}

function archiveFiles(root) {
  const compressed = regular(root, ARCHIVE); need(sha(compressed) === ARCHIVE_SHA, 'EXACT_VENDOR_BACKPORT_ARCHIVE_REQUIRED');
  const files = parseTar(zlib.gunzipSync(compressed, {maxOutputLength: 2 * 1024 * 1024}));
  need(files.size === 52 && DEPLOY.every((name) => files.has(name)) && files.has('package.json'), 'EXACT_BACKPORT_INVENTORY_REQUIRED');
  const pkg = JSON.parse(files.get('package.json'));
  const proof = JSON.parse(files.get('backport.json'));
  need(pkg.name === 'minimatch' && pkg.version === '10.2.6-pasturestack.1'
    && proof.cve === 'CVE-2026-118764' && proof.upstreamVersion === '10.2.6' && proof.runtimePatch === false, 'EXACT_SOURCE_BACKPORT_IDENTITY_REQUIRED');
  for (const name of Object.keys(ORIGINAL)) need(!files.get(name).includes(Buffer.from('sourceMappingURL=')), 'STALE_INDEX_MAP_REFERENCE_FORBIDDEN');
  return files;
}

function packageName(location) {
  const parts = location.split('/'), index = parts.lastIndexOf('node_modules');
  if (index < 0) return null;
  const tail = parts.slice(index + 1);
  return tail.length === 1 ? tail[0] : tail.length === 2 && tail[0].startsWith('@') ? tail.join('/') : null;
}

function targets(lock) {
  need(lock.lockfileVersion === 3 && lock.packages && typeof lock.packages === 'object' && !Array.isArray(lock.packages), 'NPM_LOCK_V3_REQUIRED');
  const result = [];
  for (const [location, row] of Object.entries(lock.packages)) {
    if (!location || !(row.name === 'minimatch' || packageName(location) === 'minimatch')) continue;
    need(!row.name || row.name === 'minimatch', 'LOCK_REAL_PACKAGE_IDENTITY_REQUIRED');
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(row.version || '');
    need(version, 'EXACT_MINIMATCH_VERSION_REQUIRED');
    const [, major, minor, patch] = version.map(Number);
    if (major < 7 || major > 11 || major === 11 && (minor > 0 || patch >= 1)) continue;
    need(row.version === '10.2.6' && row.integrity === INTEGRITY && row.resolved === RESOLVED && !row.link,
      'ALL_AFFECTED_MINIMATCH_MUST_BE_OFFICIAL_10_2_6');
    need(location.startsWith('node_modules/') && packageName(location), 'NODE_MODULES_LOCK_PATH_REQUIRED');
    result.push(location);
  }
  need(result.length > 0, 'NO_AFFECTED_MINIMATCH_IS_NOT_A_BACKPORT_PASS');
  return result.sort();
}

function preflight(root, location, files) {
  const directory = safePath(root, location); need(stat(directory).isDirectory(), 'REAL_MINIMATCH_DIRECTORY_REQUIRED');
  const manifest = regular(root, location + '/package.json'), pkg = JSON.parse(manifest);
  need(pkg.name === 'minimatch' && pkg.version === '10.2.6' && sha(manifest) === PACKAGE_SHA
    && (pkg._integrity === undefined || pkg._integrity === INTEGRITY), 'UNCHANGED_OFFICIAL_PACKAGE_MANIFEST_REQUIRED');
  const actual = new Map();
  for (const name of [...DEPLOY, ...Object.keys(MAPS)]) {
    const file = safePath(root, location + '/' + name, true), info = stat(file);
    need(!info || info.isFile(), 'REGULAR_PATCH_TARGET_REQUIRED');
    actual.set(name, info ? fs.readFileSync(file) : null);
  }
  const original = Object.entries(ORIGINAL).every(([name, digest]) => actual.get(name) && sha(actual.get(name)) === digest)
    && Object.entries(MAPS).every(([name, digest]) => actual.get(name) && sha(actual.get(name)) === digest)
    && ADDED.every((name) => actual.get(name) === null);
  const patched = DEPLOY.every((name) => actual.get(name) && actual.get(name).equals(files.get(name)))
    && Object.keys(MAPS).every((name) => actual.get(name) === null);
  need(original || patched, 'ALL_PACKAGE_PREIMAGES_OR_COMPLETE_PATCH_REQUIRED');
  return {location, original};
}

function applyProject(projectRoot, check = false) {
  const root = path.resolve(projectRoot), info = stat(root);
  need(info && info.isDirectory() && !info.isSymbolicLink() && path.resolve(fs.realpathSync(root)).toLowerCase() === root.toLowerCase(), 'REAL_PROJECT_ROOT_REQUIRED');
  const manifest = JSON.parse(regular(root, 'package.json'));
  need(manifest.overrides && manifest.overrides['minimatch@>=7.0.0 <11.0.1'] === '10.2.6', 'OFFICIAL_REGISTRY_OVERRIDE_REQUIRED');
  const files = archiveFiles(root), lock = JSON.parse(regular(root, 'package-lock.json')), locations = targets(lock);
  if (stat(safePath(root, 'node_modules/.package-lock.json', true))) {
    const hidden = targets(JSON.parse(regular(root, 'node_modules/.package-lock.json')));
    need(JSON.stringify(hidden) === JSON.stringify(locations), 'INSTALLED_LOCK_TARGET_SET_MUST_MATCH');
  }
  // Complete every package and map preflight before the first write anywhere.
  const states = locations.map((location) => preflight(root, location, files));
  if (check) need(states.every((state) => !state.original), 'SOURCE_BUILD_BACKPORT_MUST_BE_APPLIED_FIRST');
  else for (const state of states) {
    if (!state.original) continue;
    need(preflight(root, state.location, files).original, 'SOURCE_PREIMAGE_CHANGED_BEFORE_WRITE');
    const sourceDir = safePath(root, state.location + '/src', true);
    if (!stat(sourceDir)) fs.mkdirSync(sourceDir);
    for (const name of DEPLOY) {
      const file = safePath(root, state.location + '/' + name, true);
      const flags = (ADDED.includes(name) ? fs.constants.O_CREAT | fs.constants.O_EXCL : 0)
        | fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW || 0);
      const fd = fs.openSync(file, flags, 0o644);
      try { fs.ftruncateSync(fd, 0); fs.writeFileSync(fd, files.get(name)); } finally { fs.closeSync(fd); }
    }
    // The sole deletion allowlist: four original, hash-checked upstream index maps.
    for (const [name, digest] of Object.entries(MAPS)) {
      const file = safePath(root, state.location + '/' + name);
      need(stat(file).isFile() && sha(fs.readFileSync(file)) === digest, 'EXACT_ORIGINAL_MAP_BEFORE_UNLINK_REQUIRED');
      fs.unlinkSync(file);
    }
  }
  need(locations.every((location) => !preflight(root, location, files).original), 'COMPLETE_SOURCE_BACKPORT_VERIFICATION_REQUIRED');
  return {status: check ? 'MINIMATCH_SOURCE_BACKPORT_VERIFIED' : 'MINIMATCH_SOURCE_BACKPORT_APPLIED',
    upstreamVersion: '10.2.6', archiveSha256: ARCHIVE_SHA, packages: locations,
    changedPackages: check ? 0 : states.filter((state) => state.original).length, runtimePatch: false};
}

module.exports = {applyProject, parseTar};
if (require.main === module) {
  try {
    let root = path.resolve(__dirname, '..'), check = false;
    const args = process.argv.slice(2);
    while (args.length) {
      const arg = args.shift();
      if (arg === '--check' && !check) check = true;
      else if (arg === '--project-root' && args.length) root = args.shift();
      else throw Error('CLOSED_SOURCE_BUILD_ARGUMENTS_REQUIRED');
    }
    console.log(JSON.stringify(applyProject(root, check)));
  } catch (error) {
    console.error(/^([A-Z0-9_]+)$/.test(error.message || '') ? error.message : 'MINIMATCH_SOURCE_BACKPORT_FAILED');
    process.exitCode = 1;
  }
}
