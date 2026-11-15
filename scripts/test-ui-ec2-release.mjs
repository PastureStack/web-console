import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const root = resolve('build/ec2-release-browser');
const chrome = 'google-chrome';
const jsAssets = new Map();
const assetDirectory = join(root, 'assets');
for (const item of await readdir(assetDirectory, { withFileTypes: true })) {
  if (item.isFile() && /^[a-z0-9.-]+\.js$/i.test(item.name)) {
    jsAssets.set(`/assets/${item.name}`, await readFile(join(assetDirectory, item.name)));
  }
}
const index = await readFile(join(root, 'index.html'), 'utf8');
const bootstrap = Array.from(index.matchAll(/<script src="(\/assets\/[a-z0-9.-]+\.js)"><\/script>/gi),
  ([, source]) => source);
assert.ok(bootstrap.some(source => /\/ui(?:-[a-f\d]+)?\.js$/.test(source)), 'Missing application script');

const html = `<!doctype html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'">
</head><body data-ec2-result="pending">
<script>var runningTests = true;</script>
${bootstrap.map(source => `<script src="${source}"></script>`).join('\n')}
<script>
(async () => {
  const createEc2Client = window.require('ui/utils/ec2-client').default;
  await fetch('/fixture-start');
  const client = await createEc2Client({region: 'us-west-2', accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'release-test-placeholder', proxyEndpoint: '/v2-beta/proxy'});
  const result = await client.describeVpcs();
  if (result.Vpcs?.[0]?.VpcId !== 'vpc-release-fixture') throw new Error('Unexpected EC2 XML result');
  document.body.dataset.ec2Result = 'success';
})().catch(error => {
  document.body.dataset.ec2Result = 'failed';
  document.body.dataset.ec2Error = error.message;
});
</script></body>`;

let started = false;
let validProxyRequests = 0;
const earlyScripts = [];
const lateScripts = [];
const server = createServer(async (request, response) => {
  const path = request.url;
  switch (`${request.method} ${path}`) {
    case 'GET /':
      response.writeHead(200, { 'content-type': 'text/html' }).end(html);
      return;
    case 'GET /fixture-start':
      started = true;
      response.writeHead(204).end();
      return;
    case 'POST /v2-beta/proxy/ec2.us-west-2.amazonaws.com/': {
      let body = '';
      for await (const chunk of request) body += chunk;
      const form = new URLSearchParams(body);
      if (!started || request.headers.authorization ||
          !/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-west-2\/ec2\/aws4_request,/.test(request.headers['x-api-auth-header'] || '') ||
          !/^rancher:application\/x-www-form-urlencoded/.test(request.headers['content-type'] || '') ||
          form.get('Action') !== 'DescribeVpcs' || form.get('Version') !== '2016-11-15') {
        response.writeHead(400).end('Unexpected EC2 request');
        return;
      }
      validProxyRequests += 1;
      response.writeHead(200, { 'content-type': 'application/xml' })
        .end('<DescribeVpcsResponse><vpcSet><item><vpcId>vpc-release-fixture</vpcId></item></vpcSet></DescribeVpcsResponse>');
      return;
    }
  }

  if (request.method === 'GET' && jsAssets.has(path)) {
    (started ? lateScripts : earlyScripts).push(path);
    response.writeHead(200, { 'content-type': 'text/javascript' }).end(jsAssets.get(path));
    return;
  }
  response.writeHead(404).end();
});

const profile = await mkdtemp(join(tmpdir(), 'pasturestack-ec2-release-'));
try {
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const { stdout } = await promisify(execFile)(chrome, [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking',
    '--disable-component-update', '--no-first-run', '--no-proxy-server', `--user-data-dir=${profile}`,
    '--virtual-time-budget=15000', '--dump-dom', `http://127.0.0.1:${server.address().port}/`,
  ], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  const browserResult = stdout.match(/<body [^>]*>/)?.[0] || 'missing result';
  assert.match(browserResult, /<body data-ec2-result="success"/, 'Packaged EC2 client failed in Chromium');
  assert.deepEqual([...earlyScripts].sort(), [...bootstrap].sort(), 'Unexpected eager script requests');
  assert.ok(lateScripts.some(path => /^\/assets\/chunk\./.test(path) && !bootstrap.includes(path)),
    'Calling the packaged EC2 client did not request a separate JavaScript chunk');
  assert.equal(validProxyRequests, 1);
  console.log('WEB_CONSOLE_EC2_RELEASE_OK lazy=1 same_origin_proxy=1');
} finally {
  server.closeAllConnections();
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
