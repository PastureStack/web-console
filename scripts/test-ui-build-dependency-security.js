'use strict';

// Executable regressions for the reviewed build-only dependency updates. The
// optional root is for a small local test fixture; CI uses the real install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const zlib = require('node:zlib');

const root = path.resolve(process.env.PASTURESTACK_TEST_DEPENDENCY_ROOT || path.join(__dirname, '..'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
let dependencyCache;

function packageFrom(consumerRequire, name) {
  const entry = consumerRequire.resolve(name);
  let directory = path.dirname(entry);
  for (;;) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = readJson(manifest);
      if (pkg.name === name) {
        const relative = path.relative(fs.realpathSync(root), fs.realpathSync(directory));
        assert.ok(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep),
          name + ' must resolve inside the selected dependency root');
        return { pkg, entry, manifest, require: createRequire(manifest) };
      }
    }
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, 'package identity not found for ' + name);
    directory = parent;
  }
}

function dependencies() {
  if (dependencyCache) return dependencyCache;
  const lock = readJson(path.join(root, 'package-lock.json'));
  assert.ok(lock.packages && lock.packages[''], 'the actual npm install lock is required');
  const selected = {}, expected = { body: '5.1.0', 'body-parser': '2.4.0', 'fast-uri': '3.1.9', 'serialize-javascript': '7.1.3' };
  const counts = {};
  for (const [name, version] of Object.entries(expected)) {
    let consumers = 0;
    for (const [location, node] of Object.entries(lock.packages)) {
      const declared = { ...node.dependencies, ...node.optionalDependencies, ...(!location ? node.devDependencies : {}) };
      if (!Object.hasOwn(declared, name)) continue;
      const target = node.link ? node.resolved : location;
      const consumerFile = path.join(root, target, 'package.json');
      const consumer = readJson(consumerFile);
      if (node.version) assert.equal(consumer.version, node.version, 'installed consumer matches its lock');
      const installed = packageFrom(createRequire(consumerFile), name);
      assert.equal(installed.pkg.version, version, name + ' resolved by its real consumer');
      selected[name] ||= installed;
      consumers++;
    }
    assert.ok(consumers > 0, 'no installed consumers found for ' + name);
    counts[name] = consumers;
  }
  const legacyRaw = packageFrom(selected.body.require, 'raw-body');
  const modernRaw = packageFrom(selected['body-parser'].require, 'raw-body');
  assert.equal(legacyRaw.pkg.version, '2.5.3', 'body@5.1.0 consumes its reviewed callback-compatible raw-body');
  assert.equal(modernRaw.pkg.version, '3.0.2', 'body-parser consumes its official modern raw-body line');
  assert.equal(packageFrom(selected['body-parser'].require, 'qs').pkg.version, '6.16.1');
  dependencyCache = { selected, counts };
  return dependencyCache;
}

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try { await run(server.address().port); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

function request(port, { body, encoding = 'identity', method = 'POST', url = '/', length, deferEnd = false } = {}) {
  let client;
  const response = new Promise((resolve, reject) => {
    const headers = method === 'POST' ? { 'Content-Type': 'application/json', 'Content-Encoding': encoding,
      'Content-Length': length ?? body.length } : {};
    client = http.request({ host: '127.0.0.1', port, path: url, method, agent: false, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('Response aborted')));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    client.on('error', reject);
    client.setTimeout(2500, () => client.destroy(new Error('Dependency regression HTTP request timed out')));
    if (deferEnd) client.write(body); else client.end(body);
  });
  return { client, response };
}

function health(req, res) {
  if (req.method !== 'GET' || req.url !== '/health') return false;
  res.end('healthy');
  return true;
}

function respond(res, value) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(value));
}

function parserMiddleware() {
  const installed = dependencies().selected['body-parser'];
  return { parse: installed.require(installed.entry).json(), onFinished: installed.require('on-finished') };
}

async function legacyBody() {
  const installed = dependencies().selected.body, body = installed.require(installed.entry);
  await withServer((req, res) => {
    if (health(req, res)) return;
    body(req, res, { limit: req.url === '/limit' ? 16 : 1024, encoding: 'utf8' }, (error, text) => {
      if (error) { req.resume(); res.statusCode = error.statusCode || error.status || 500; respond(res, { type: error.type }); return; }
      respond(res, { text });
    });
  }, async port => {
    const text = '繁體中文與 UTF-8 🐑';
    const valid = await request(port, { body: Buffer.from(text) }).response;
    assert.equal(valid.status, 200);
    assert.equal(JSON.parse(valid.text).text, text);
    const limited = await request(port, { body: Buffer.alloc(2048, 0x61), url: '/limit' }).response;
    assert.equal(limited.status, 413);
    assert.equal(JSON.parse(limited.text).type, 'entity.too.large');
    assert.deepEqual(await request(port, { method: 'GET', url: '/health' }).response, { status: 200, text: 'healthy' });
  });
}

async function validJsonEncodings() {
  const { parse, onFinished } = parserMiddleware();
  await withServer((req, res) => {
    if (health(req, res)) return;
    parse(req, res, error => {
      assert.ifError(error);
      onFinished(req, error => { assert.ifError(error); respond(res, req.body); });
    });
  }, async port => {
    const value = { message: '合法繁體 JSON', values: [1, true, null] }, bytes = Buffer.from(JSON.stringify(value));
    for (const [encoding, body] of [['identity', bytes], ['gzip', zlib.gzipSync(bytes)], ['deflate', zlib.deflateSync(bytes)]]) {
      const result = await request(port, { encoding, body }).response;
      assert.equal(result.status, 200, encoding);
      assert.deepEqual(JSON.parse(result.text), value);
    }
  });
}

async function deflateTrailing() {
  // Upstream CVE-2026-111181 regression: the parser callback, not a timer,
  // releases the rest of the HTTP body to downstream on-finished middleware.
  // https://github.com/expressjs/body-parser/commit/f7075ea.patch
  const { parse, onFinished } = parserMiddleware();
  const first = Buffer.concat([zlib.deflateSync(Buffer.from('{"a":1}')), Buffer.from([0])]);
  const trailing = Buffer.alloc(1024);
  let client, barrierReached = false;
  await withServer((req, res) => {
    if (health(req, res)) return;
    parse(req, res, error => {
      assert.ifError(error);
      assert.equal(req.complete, false, 'HTTP trailing bytes have not been sent at the parser barrier');
      barrierReached = true;
      onFinished(req, error => { assert.ifError(error); respond(res, req.body); });
      client.end(trailing);
    });
  }, async port => {
    const pending = request(port, { encoding: 'deflate', body: first, length: first.length + trailing.length, deferEnd: true });
    client = pending.client;
    const result = await pending.response;
    assert.equal(barrierReached, true);
    assert.deepEqual(result, { status: 200, text: '{"a":1}' });
    assert.deepEqual(await request(port, { method: 'GET', url: '/health' }).response, { status: 200, text: 'healthy' });
  });
}

async function gzipTrailing() {
  // Observe completion without attaching an error listener to the decoder or
  // catching uncaughtException: an unhandled zlib error must fail this child.
  const descriptor = Object.getOwnPropertyDescriptor(zlib, 'createGunzip');
  const original = zlib.createGunzip;
  let closeObserved = false, closeDecoder;
  const decoderClosed = new Promise(resolve => { closeDecoder = resolve; });
  Object.defineProperty(zlib, 'createGunzip', { configurable: true, enumerable: descriptor.enumerable, writable: true,
    value(...args) {
      const decoder = original.apply(this, args);
      decoder.once('close', () => { closeObserved = true; closeDecoder(); });
      return decoder;
    } });
  try {
    const { parse, onFinished } = parserMiddleware();
    const payload = Buffer.concat([zlib.gzipSync(Buffer.from('{"a":1}')), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]);
    await withServer((req, res) => {
      if (health(req, res)) return;
      parse(req, res, error => {
        assert.ifError(error);
        onFinished(req, error => { assert.ifError(error); respond(res, req.body); });
      });
    }, async port => {
      const [result] = await Promise.all([request(port, { encoding: 'gzip', body: payload }).response, decoderClosed]);
      assert.equal(closeObserved, true);
      assert.deepEqual(result, { status: 200, text: '{"a":1}' });
      assert.deepEqual(await request(port, { method: 'GET', url: '/health' }).response, { status: 200, text: 'healthy' });
    });
  } finally { Object.defineProperty(zlib, 'createGunzip', descriptor); }
}

function checkFastUri() {
  const installed = dependencies().selected['fast-uri'], uri = installed.require(installed.entry);
  // https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg
  for (const encoded of ['%6Aavascript:alert(1)', '%u006Aavascript:alert(1)']) {
    const parsed = uri.parse(encoded);
    assert.ok(parsed.error);
    assert.notEqual(parsed.scheme, 'javascript');
    assert.equal(uri.normalize(encoded), encoded, 'invalid encoded scheme stays inert');
    assert.throws(() => uri.resolve('https://example.test/', encoded), /malformed/i);
    assert.equal(uri.equal(encoded, 'javascript:alert(1)'), false);
  }
  assert.equal(uri.equal('%68ttp://example.test/', 'http://example.test/'), false);
  assert.equal(uri.normalize('HTTP://EXAMPLE.COM:80/a/../b'), 'http://example.com/b');
  assert.equal(uri.resolve('https://example.test/a/b/', '../z?x=1#f'), 'https://example.test/a/z?x=1#f');
  assert.equal(uri.normalize('../a/../b'), '../b');
  assert.equal(uri.equal('https://EXAMPLE.test:443/path', 'https://example.test/path'), true);
  // Preserve the previous percent-encoded host case-normalization fix.
  assert.equal(uri.normalize('http://%45XAMPLE.COM/'), 'http://example.com/');
  assert.equal(uri.equal('http://%65XAMPLE.com/', 'http://example.com/'), true);
}

function checkSerialize() {
  const installed = dependencies().selected['serialize-javascript'], serialize = installed.require(installed.entry);
  // Official spoofed-toString PoC, checked as HTML tokenization rather than
  // evaluated as JavaScript. Ordinary function/data compatibility is separate.
  // https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-m5mm-p8h7-m29v
  function f() {}
  f.toString = () => 'function f(){ return 1 }//</script';
  function g() {}
  g.toString = () => 'function g(x){ return x } > <img src=x onerror=alert(1)>';
  const hostile = serialize({ a: { f }, g }, { space: 2 });
  assert.equal(/<\/script[\t\n\f\r \/>]/i.test(hostile), false, 'serialized output must not terminate its enclosing script element');
  assert.ok(hostile.includes('//\\u003C\\u002Fscript\n'));
  const data = { text: '繁體 </script> & data', array: [1, true, null], nested: { value: 7 } };
  assert.deepEqual(JSON.parse(serialize(data, { isJSON: true })), data);
  function add(left, right) { return left + right; }
  const output = serialize({ data, add }, { space: 2 });
  const roundtrip = vm.runInNewContext('(' + output + ')', Object.create(null), { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(roundtrip.data)), data);
  assert.equal(roundtrip.add(2, 3), 5);
}

const scenarios = { 'legacy-body': legacyBody, 'valid-json': validJsonEncodings,
  'deflate-trailing': deflateTrailing, 'gzip-trailing': gzipTrailing };
if (process.argv[2] === '--dependency-security-child') {
  const name = process.argv[3];
  assert.ok(Object.hasOwn(scenarios, name), 'unknown dependency security scenario');
  scenarios[name]().then(() => console.log('DEPENDENCY_SECURITY_CHILD_OK ' + name)).catch(error => {
    console.error(error.stack); process.exitCode = 1;
  });
} else {
  const { test } = require('node:test');
  test('real consumers resolve the reviewed versions and distinct legacy/modern raw-body lines', () => {
    const { counts } = dependencies();
    assert.ok(Object.values(counts).every(count => count > 0));
  });
  test('fast-uri rejects both encoded schemes while preserving URI/ref/equality and host normalization', checkFastUri);
  test('serialize-javascript neutralizes the official bare script suffix PoC and preserves roundtrips', checkSerialize);
  for (const name of Object.keys(scenarios)) {
    test('isolated actual HTTP/stream regression: ' + name, { timeout: 15000 }, () => {
      const child = spawnSync(process.execPath, [__filename, '--dependency-security-child', name], {
        env: process.env, encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024, killSignal: 'SIGKILL',
      });
      assert.ifError(child.error);
      assert.equal(child.signal, null, name + ' must not crash or hang');
      assert.equal(child.status, 0, child.stderr || child.stdout);
      assert.match(child.stdout, new RegExp('DEPENDENCY_SECURITY_CHILD_OK ' + name));
    });
  }
}
