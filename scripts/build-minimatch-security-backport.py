#!/usr/bin/env python3
"""Reproduce the official CVE fix without changing the minimatch 10 public API.

No network, install or arbitrary patch input. --build creates a new source
dependency archive; the default validates its exact reproducible bytes.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor/minimatch-security-backport'
VERSION = '10.2.6-pasturestack.1'
ARCHIVE = VENDOR / ('minimatch-' + VERSION + '.tgz')
UPSTREAM_SHA256 = '5a3d2c8074a28229665727e47b8a1090941856a7962905efe05d20d3760355f8'
FIX_SOURCE_SHA256 = 'eff2f23257708f4bd102cf94d746c8f26f5887e993e6de0f3c139bdae924c37b'
FIX_COMMIT = '47afe882784638ccdee8d30e0b7516aed2b589a9'
MAPS = {f'dist/{mode}/index.{kind}.map' for mode in ('commonjs', 'esm') for kind in ('js', 'd.ts')}


def need(value, code):
    if not value:
        raise ValueError(code)


def once(source, before, after):
    need(source.count(before) == 1, 'OFFICIAL_BACKPORT_PREIMAGE_CHANGED')
    return source.replace(before, after, 1)


def patch(source, typescript=False):
    """Only the upstream 11.0.1 preprocessing fix; no matcher/API rewrite."""
    first = 'firstPhasePreProcess(globParts: string[][]) {' if typescript else 'firstPhasePreProcess(globParts) {'
    second = 'secondPhasePreProcess(globParts: string[][]): string[][] {' if typescript else 'secondPhasePreProcess(globParts) {'
    indent = '    ' if typescript else '        '
    semicolon = '' if typescript else ';'
    source = once(source, first + '\n', first + '\n' + indent
                  + '// each **/.. split doubles the patterns, so stop at the brace max\n'
                  + indent + 'const { braceExpandMax = 100_000 } = this.options' + semicolon + '\n')
    start, end = source.index(first), source.index(second)
    body = once(source[start:end], "p2 === '..'", "p2 === '..' ||\n" + indent * 2
                + ('    ' if typescript else '        ') + 'globParts.length >= braceExpandMax')
    source = source[:start] + body + source[end:]
    source = once(source, second + '\n', second + '\n' + indent
                  + '// each pattern is compared to each other one, so skip this for\n'
                  + indent + '// large sets. The patterns match the same paths either way.\n'
                  + indent + 'if (globParts.length > 1000) return globParts' + semicolon + '\n')
    return source


def upstream_files():
    raw = (VENDOR / 'upstream-minimatch-10.2.6.tgz').read_bytes()
    need(hashlib.sha256(raw).hexdigest() == UPSTREAM_SHA256, 'EXACT_OFFICIAL_MINIMATCH10_ARCHIVE_REQUIRED')
    fixed = (VENDOR / 'upstream-11.0.1-index.ts').read_bytes()
    need(hashlib.sha256(fixed).hexdigest() == FIX_SOURCE_SHA256, 'EXACT_SIGNED_UPSTREAM_FIX_SOURCE_REQUIRED')
    need(b'globParts.length >= braceExpandMax' in fixed
         and b'if (globParts.length > 1000) return globParts' in fixed, 'OFFICIAL_FIX_HUNKS_REQUIRED')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for row in archive.getmembers():
            parts = Path(row.name).parts
            need(row.isfile() and row.name.startswith('package/') and '..' not in parts
                 and len(parts) > 1 and row.size <= 2 * 1024 ** 2, 'OFFICIAL_ARCHIVE_FILE_BOUNDARY_REQUIRED')
            name = row.name[len('package/'):]
            need(name not in files, 'UNIQUE_OFFICIAL_FILE_REQUIRED')
            files[name] = archive.extractfile(row).read()
    need(len(files) == 53 and sum(map(len, files.values())) == 536122, 'EXACT_OFFICIAL_FILE_INVENTORY_REQUIRED')
    return files


def candidate_files():
    original = upstream_files()
    files = dict(original)
    package = json.loads(files['package.json'])
    need(package['name'] == 'minimatch' and package['version'] == '10.2.6', 'OFFICIAL_PACKAGE_IDENTITY_REQUIRED')
    package['version'] = VERSION
    package['pasturestackSecurityBackport'] = {'cve': 'CVE-2026-118764', 'upstreamVersion': '10.2.6',
                                             'upstreamFixCommit': FIX_COMMIT}
    package['files'] += ['src/index.ts', 'BACKPORT.md', 'backport.json']
    files['package.json'] = (json.dumps(package, indent=2) + '\n').encode()
    source = json.loads(original['dist/esm/index.js.map'])
    need(source['sources'] == ['../../src/index.ts'] and len(source['sourcesContent']) == 1,
         'EXACT_UPSTREAM_TYPESCRIPT_SOURCE_REQUIRED')
    source = patch(source['sourcesContent'][0], typescript=True)
    files['src/index.ts'] = source.encode()
    for mode in ('commonjs', 'esm'):
        name = f'dist/{mode}/index.js'
        files[name] = once(patch(original[name].decode()), '//# sourceMappingURL=index.js.map',
                           '// Patched source: ../../src/index.ts; stale upstream index map omitted.').encode()
        name = f'dist/{mode}/index.d.ts'
        files[name] = once(original[name].decode(), '//# sourceMappingURL=index.d.ts.map',
                           '// Upstream declaration API retained; index source map omitted.').encode()
    for name in MAPS:
        need(name in files, 'EXACT_INDEX_MAP_OMISSION_REQUIRED')
        del files[name]
    files['BACKPORT.md'] = (VENDOR / 'UPSTREAM.md').read_bytes()
    files['backport.json'] = (json.dumps({
        'cve': 'CVE-2026-118764', 'version': VERSION, 'upstreamVersion': '10.2.6',
        'upstreamArchiveSha256': UPSTREAM_SHA256, 'officialFixCommit': FIX_COMMIT,
        'officialFixSourceSha256': FIX_SOURCE_SHA256, 'sourceMapsOmitted': sorted(MAPS),
        'runtimePatch': False, 'upstreamApiPreserved': ['matchOne', 'makeRe', 'set RegExp'],
        'patchedFiles': {name: hashlib.sha256(files[name]).hexdigest() for name in
                         ('src/index.ts', 'dist/commonjs/index.js', 'dist/esm/index.js')},
    }, indent=2) + '\n').encode()
    changed = {name for name in original if name not in files or files[name] != original[name]}
    need(changed == MAPS | {'package.json', 'dist/commonjs/index.js', 'dist/esm/index.js',
                           'dist/commonjs/index.d.ts', 'dist/esm/index.d.ts'}, 'ONLY_DECLARED_BACKPORT_FILES_MAY_CHANGE')
    return files


def archive_bytes():
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', mtime=0, filename='', compresslevel=9) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
            for name, raw in sorted(candidate_files().items()):
                row = tarfile.TarInfo('package/' + name)
                row.size = len(raw)
                row.mode = 0o644
                row.mtime = row.uid = row.gid = 0
                row.uname = row.gname = ''
                archive.addfile(row, io.BytesIO(raw))
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true')
    args = parser.parse_args()
    raw = archive_bytes()
    if args.build:
        need(not ARCHIVE.exists(), 'PRESERVE_EXISTING_IMMUTABLE_BACKPORT_ARCHIVE')
        with ARCHIVE.open('xb') as stream:
            stream.write(raw)
    need(ARCHIVE.is_file() and ARCHIVE.read_bytes() == raw, 'REPRODUCIBLE_OFFICIAL_BACKPORT_ARCHIVE_REQUIRED')
    print(json.dumps({'status': 'PASS_REPRODUCIBLE_OFFICIAL_BACKPORT', 'version': VERSION,
                      'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'runtimePass': False}))


if __name__ == '__main__':
    main()
