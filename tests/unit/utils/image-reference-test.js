import { module, test } from 'qunit';
import { parseImageReference, sameImageReference, loadBalancerImageCandidate } from 'ui/utils/image-reference';

module('Unit | Utility | image reference');
const REPO = 'ghcr.io/pasturestack/load-balancer-service';
const A = 'sha256:' + 'a'.repeat(64);
const B = 'sha256:' + 'b'.repeat(64);

test('normalizes Docker transport, default registry, library and latest', function(assert) {
  assert.deepEqual(parseImageReference('docker:busybox'), parseImageReference('docker.io/library/busybox:latest'));
  assert.true(sameImageReference('docker://index.docker.io/library/busybox:latest', 'busybox'));
  assert.strictEqual(parseImageReference('localhost:5000/team/lb:v1').repository, 'localhost:5000/team/lb');
  assert.strictEqual(parseImageReference('registry.example:5000/team/lb:Tag').tag, 'Tag');
});

test('image identity is exact and digest identity does not depend on tag text', function(assert) {
  assert.true(sameImageReference(REPO + ':v0.9.35', 'docker:' + REPO + ':v0.9.35'));
  assert.false(sameImageReference(REPO + ':v0.9.35', REPO + ':v0.9.350'));
  assert.false(sameImageReference(REPO + ':v0.9.35', REPO + ':v0.9.35-custom'));
  assert.true(sameImageReference(REPO + ':v0.9.35@' + A, REPO + '@' + A));
  assert.false(sameImageReference(REPO + '@' + A, REPO + '@' + B));
  assert.true(sameImageReference(A, REPO + '@' + A));
  assert.strictEqual(sameImageReference(REPO + ':v0.9.35', REPO + ':v0.9.35@' + A), null,
    'a browser cannot resolve a tag to a digest by string matching');
});

test('missing and malformed references never produce a candidate', function(assert) {
  for (let input of [null, undefined, '', 'docker:', 'https://ghcr.io/x:v1', 'repo:bad tag',
    REPO + '@sha256:short', REPO + '@' + A + '@' + B, 'UPPER/repo:v1']) {
    assert.strictEqual(parseImageReference(input), null, String(input));
    assert.strictEqual(loadBalancerImageCandidate(input, REPO + ':v0.9.35', true), null);
  }
});

test('managed release candidate requires permission, a matching repository and newer release', function(assert) {
  let old = 'docker:' + REPO + ':v0.9.34';
  let next = REPO + ':v0.9.35';
  assert.deepEqual(loadBalancerImageCandidate(old, next, true), {
    from: REPO + ':v0.9.34', to: next, fromLabel: 'v0.9.34', toLabel: 'v0.9.35',
  });
  assert.strictEqual(loadBalancerImageCandidate(old, next, false), null);
  assert.strictEqual(loadBalancerImageCandidate(next, next, true), null);
  assert.strictEqual(loadBalancerImageCandidate(REPO + ':v0.9.350', next, true), null, 'never downgrade a similar prefix');
  assert.ok(loadBalancerImageCandidate(REPO + ':v0.9.3', next, true), 'tag prefixes are not equal');
  assert.ok(loadBalancerImageCandidate(old, next + '@' + B, true), 'an explicit published digest target can be previewed');
});

test('digest pins, digest-only, custom repositories and custom tags are preserved', function(assert) {
  for (let current of [REPO + ':v0.9.34@' + A, REPO + '@' + A, A,
    'registry.example/company/lb:v0.9.34', REPO + ':v0.9.34-hotfix', REPO + ':custom']) {
    assert.strictEqual(loadBalancerImageCandidate(current, REPO + ':v0.9.35', true), null, current);
  }
});
