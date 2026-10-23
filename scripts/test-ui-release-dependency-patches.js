'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const redirects = require('follow-redirects');
const MarkdownIt = require('markdown-it');

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

function get(url, options) {
  return new Promise((resolve, reject) => {
    const request = redirects.http.get(url, options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve(JSON.parse(body)));
      response.on('error', reject);
    });
    request.setTimeout(2000, () => request.destroy(new Error('redirect test timed out')));
    request.on('error', reject);
  });
}

test('official dependency patches are installed at every locked occurrence', () => {
  const lock = require('../package-lock.json');
  for (const [name, version] of Object.entries({'follow-redirects': '1.16.1', 'markdown-it': '14.3.3'})) {
    const occurrences = Object.entries(lock.packages).filter(([namePath]) => namePath.endsWith(`node_modules/${name}`));
    assert.ok(occurrences.length > 0);
    for (const [namePath, entry] of occurrences) {
      assert.equal(entry.version, version);
      assert.equal(require(`../${namePath}/package.json`).version, version);
    }
  }
});

test('cross-origin redirects strip array credentials and regex-significant custom headers', async () => {
  const target = await listen((request, response) => response.end(JSON.stringify(request.headers)));
  const origin = await listen((request, response) => {
    response.writeHead(302, {Location: `http://127.0.0.1:${target.address().port}/target`});
    response.end();
  });
  try {
    const url = `http://127.0.0.1:${origin.address().port}/redirect`;
    for (const headers of [
      ['Authorization', 'test-auth', 'Proxy-Authorization', 'test-proxy', 'Cookie', 'test-cookie', 'X-Control', 'keep'],
      {'Authorization': 'test-auth', 'Proxy-Authorization': 'test-proxy', 'Cookie': 'test-cookie', 'X-Control': 'keep'},
    ]) {
      const received = await get(url, {headers});
      assert.equal(received.authorization, undefined);
      assert.equal(received['proxy-authorization'], undefined);
      assert.equal(received.cookie, undefined);
      assert.equal(received['x-control'], 'keep');
    }
    const received = await get(url, {
      headers: {'X-Token^Key': 'test-one', 'X-Token|Key': 'test-two', 'X-Control': 'keep'},
      sensitiveHeaders: ['X-Token^Key', 'X-Token|Key'],
    });
    assert.equal(received['x-token^key'], undefined);
    assert.equal(received['x-token|key'], undefined);
    assert.equal(received['x-control'], 'keep');
  } finally {
    await close(origin);
    await close(target);
  }
});

test('same-origin redirects retain legitimate authentication headers', async () => {
  const server = await listen((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, {Location: '/target'});
      response.end();
    } else {
      response.end(JSON.stringify(request.headers));
    }
  });
  try {
    const received = await get(`http://127.0.0.1:${server.address().port}/redirect`, {
      headers: {Authorization: 'test-auth', Cookie: 'test-cookie'},
    });
    assert.equal(received.authorization, 'test-auth');
    assert.equal(received.cookie, 'test-cookie');
  } finally {
    await close(server);
  }
});

test('Markdown retains ordinary links, Unicode and enabled HTML', () => {
  assert.equal(new MarkdownIt().render('[連結][ref]\n\n[ref]: https://example.test "Title"\n'),
    '<p><a href="https://example.test" title="Title">連結</a></p>\n');
  assert.equal(new MarkdownIt({html: true}).render('before <b>after</b>'), '<p>before <b>after</b></p>\n');
});

test('Markdown bounds malformed multi-line references and all special inline HTML openers', () => {
  const child = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const MarkdownIt = require('markdown-it');
    const markdown = new MarkdownIt();
    for (const input of ['[' + 'word\\n'.repeat(60000), '[label]: /url "' + 'word\\n'.repeat(60000)]) {
      assert.ok(markdown.render(input).length > 0);
    }
    const html = new MarkdownIt({html: true});
    for (const opener of ['<!--', '<?', '<!A', '<![CDATA[']) {
      assert.ok(html.render('x ' + opener.repeat(100000)).length > 0);
    }
  `], {cwd: process.cwd(), encoding: 'utf8', timeout: 8000, maxBuffer: 8192});
  assert.equal(child.error, undefined, 'pathological inputs finish within the bounded worker');
  assert.equal(child.status, 0, child.stderr);
});
