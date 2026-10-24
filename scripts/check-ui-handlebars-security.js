'use strict';

// Dependency regressions for the official 4.7.10 fixes. This is the Node
// build-tool package, not Ember's separate Glimmer template compiler.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const Handlebars = require('handlebars');

test('every locked and installed Handlebars instance uses the official patch', () => {
  const entries = Object.entries(lock.packages).filter(([p]) => /(?:^|\/)node_modules\/handlebars$/.test(p));
  assert.ok(entries.length > 0);
  for (const [p, item] of entries) {
    assert.equal(item.version, '4.7.10', p);
    assert.equal(require(path.join(root, p, 'package.json')).version, '4.7.10', p);
  }
  for (const owner of ['broccoli', 'broccoli-middleware', 'ember-auto-import']) {
    const fromOwner = createRequire(require.resolve(owner + '/package.json'));
    assert.equal(fromOwner('handlebars').VERSION, '4.7.10', owner);
  }
});

test('CVE-2026-106445 blocks Function constructor lookup even with prototype methods enabled', () => {
  const render = Handlebars.compile('{{lookup (lookup fn "__proto__") "constructor"}}');
  assert.equal(render({ fn() {} }, { allowProtoMethodsByDefault: true }), '');
  assert.equal(Handlebars.compile('{{constructor.name}}')({ constructor: { name: 'ordinary-data' } }), 'ordinary-data');
});

test('CVE-2026-106446 rejects a forged blockParams AST in compile and precompile', () => {
  for (const method of ['compile', 'precompile']) {
    const ast = Handlebars.parse('{{#if enabled}}safe{{/if}}');
    ast.body[0].program.blockParams = { length: '(()=>{throw new Error("AST_MARKER")})()' };
    assert.throws(() => {
      const result = Handlebars[method](ast);
      if (method === 'compile') result({ enabled: true });
    }, error => error.message !== 'AST_MARKER' && /invalid|blockParams|AST/i.test(error.message));
  }
});

test('CVE-2026-106444 escapes an inline script terminator without changing rendered text', () => {
  const literal = 'safe</script><script>marker()</script><script>';
  const compiled = Handlebars.precompile(literal);
  assert.equal(/<\/script/i.test(compiled), false);
  const spec = vm.runInNewContext('(' + compiled + ')', Object.create(null), { timeout: 1000 });
  assert.equal(Handlebars.template(spec)({}), literal);
});

test('legitimate strings, parsed AST, block params, partials and precompiled runtime remain compatible', () => {
  const local = Handlebars.create();
  local.registerPartial('item', '{{index}}:{{name}};');
  const text = '{{#each items as |item index|}}{{> item name=item.name index=index}}{{/each}}';
  const data = { items: [{ name: '<first>' }, { name: 'second' }] };
  const expected = '0:&lt;first&gt;;1:second;';
  assert.equal(local.compile(text)(data), expected);
  assert.equal(local.compile(local.parse(text))(data), expected);
  const compiled = vm.runInNewContext('(' + local.precompile(text) + ')', Object.create(null), { timeout: 1000 });
  assert.equal(local.template(compiled)(data), expected);
  // ember-auto-import's build helper uses the normal #each path.
  assert.equal(local.compile('{{#each entries}}require("{{this}}");{{/each}}')({ entries: ['one', 'two'] }),
    'require("one");require("two");');
});

test('CVE-2026-86472 uses the official fast-uri host normalization patch', () => {
  const uri = require('fast-uri');
  assert.equal(require('fast-uri/package.json').version, '3.1.9');
  for (const host of ['//%41.com', '//A.com', '//a.com']) assert.equal(uri.parse(host).host, 'a.com');
  assert.equal(uri.equal('//%41.com', '//a.com'), true);
  assert.equal(uri.parse('https://example.com/api?limit=10').host, 'example.com');
  assert.equal(uri.equal('https://one.example/', 'https://two.example/'), false);
});
