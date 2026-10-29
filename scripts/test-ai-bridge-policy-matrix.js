'use strict';
// Only the changed bridge availability overlay is exercised here. The normal
// policy is an intent ceiling; the live server remains the authorization oracle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../app/utils');
const urls = new Map();
function url(name) {
  if (urls.has(name)) { return urls.get(name); }
  const source = fs.readFileSync(path.join(root, `${name}.js`), 'utf8').replace(/from '(ui\/utils\/[^']+|\.\/[^']+)'/g,
    (_, specifier) => `from '${url(specifier.replace(/^ui\/utils\/|^\.\//, ''))}'`);
  const result = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  urls.set(name, result); return result;
}
async function main() {
  const {buildPolicyMatrix} = await import(url('api-key-policy-matrix'));
  const {scopeKey} = await import(url('api-key-owner-capabilities'));
  const operations = ['read', 'create', 'update', 'upgrade', 'delete', 'exec', 'logs', 'export'];
  const labels = {default: 'Outside selected scopes', global: 'All resources', unverified: 'Select a verified named target'};
  let cases = 0;
  const test = (name, body) => { body(); cases++; console.log(`PASS ${name}`); };
  const full = {mode: 'full', defaultEffect: 'allow', rules: []};
  const matrix = (policy, evidence = {}) => buildPolicyMatrix(policy, evidence, labels);
  test('ordinary full access is unchanged for every operation', () => {
    assert.ok(matrix(full).rows[0].cells.every(cell => cell.state === 'allow' && cell.policyState === 'allow'));
  });
  test('bridge full is conditional only for the implemented business subset', () => {
    const cells = matrix({...full, purpose: 'ai-bridge'}).rows[0].cells;
    for (const cell of cells) {
      assert.equal(cell.policyState, 'allow');
      assert.equal(cell.state, ['read', 'create', 'update', 'upgrade', 'delete'].includes(cell.operation) ? 'conditional' : 'unsupported');
    }
  });
  test('closed and expired bridge Keys remain denied for every operation', () => {
    assert.ok(matrix({mode: 'closed', defaultEffect: 'deny', purpose: 'ai-bridge', rules: []}).rows[0].cells.every(cell => cell.state === 'deny'));
    assert.ok(matrix({...full, purpose: 'ai-bridge', expiresAt: '2000-01-01T00:00:00Z'}).rows[0].cells.every(cell => cell.state === 'deny'));
  });
  function point(resourceType) {
    const scope = {kind: 'resource', resourceType, resourceId: 'named-target'};
    const policy = {mode: 'custom', defaultEffect: 'deny', purpose: 'ai-bridge', rules: [{id: 'target', scope, effect: 'allow', operations}]};
    const proof = {scopeKey: scopeKey(scope), selectionValid: true, contextVerified: true, complete: true, selectionLabel: 'Test target',
      projectId: 'project-a', stackId: ['service', 'container', 'volume'].includes(resourceType) ? 'stack-a' : null,
      stackContextStatus: resourceType === 'container' ? 'verified' : undefined,
      resource: {id: 'named-target', type: resourceType, accountId: 'project-a', stackId: resourceType === 'service' || resourceType === 'container' ? 'stack-a' : null}};
    return matrix(policy, {target: proof}).rows.find(row => row.kind === 'resource').cells;
  }
  test('stack service and container points offer only their registered writes', () => {
    for (const resourceType of ['stack', 'service', 'container']) {
      for (const cell of point(resourceType)) {
        const supported = ['read', 'update', 'delete'].includes(cell.operation) || cell.operation === 'upgrade' && resourceType === 'service';
        assert.equal(cell.state, supported ? 'conditional' : 'unsupported', `${resourceType}/${cell.operation}`);
      }
    }
  });
  test('sensitive metadata reads never advertise credential or infrastructure writes', () => {
    for (const resourceType of ['certificate', 'setting', 'registry', 'apiKey', 'account', 'host', 'volume']) {
      for (const cell of point(resourceType)) {
        assert.equal(cell.state, cell.operation === 'read' ? 'conditional' : 'unsupported', `${resourceType}/${cell.operation}`);
      }
    }
  });
  test('resource points never claim the ability to create a new child or sibling', () => {
    for (const resourceType of ['project', 'stack', 'service', 'container']) {
      assert.equal(point(resourceType).find(cell => cell.operation === 'create').state, 'unsupported');
    }
  });
  console.log(JSON.stringify({status: 'PASS', cases, scope: 'changed bridge policy matrix only'}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
