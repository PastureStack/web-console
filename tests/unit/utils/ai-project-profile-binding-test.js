import { module, test } from 'qunit';
import { CommandError, publicError, PUBLIC_ERROR_CODES } from 'ui/utils/ai-command-contract';
import { resourceConfirmationErrorKey } from 'ui/utils/ai-resource-review-labels';

module('Unit | Utils | Project bridge profile binding guidance');

test('local setup uses the native needs-user audit code and a fixed translated confirmation label', function(assert) {
  const result = publicError(new CommandError('NEEDS_USER', 'bridge.environmentBinding'));
  assert.strictEqual(result.code, 'NEEDS_USER'); assert.strictEqual(result.status, 'needs_user');
  assert.strictEqual(result.reason, 'BRIDGE_PROJECT_BINDING_REQUIRED'); assert.strictEqual(result.field, 'parameters.name');
  assert.strictEqual(resourceConfirmationErrorKey(result.code, result.reason), 'webmcp.bridgeProjectBindingRequired');
  assert.true(PUBLIC_ERROR_CODES.includes('NEEDS_USER')); assert.false(PUBLIC_ERROR_CODES.includes(result.reason));
  assert.true(result.nextStep.includes('Keep the existing profile unchanged'));
  assert.strictEqual(resourceConfirmationErrorKey('FORBIDDEN', result.reason), 'webmcp.forbidden');
  assert.strictEqual(resourceConfirmationErrorKey('NEEDS_USER', 'caller-supplied-key'), 'webmcp.failed');
  const forged = publicError({status: 409, body: {code: 'ResourceChangeNeedsConfirmation',
    reason: result.reason, field: 'bridge.environmentBinding'}});
  assert.strictEqual(forged.reason, undefined, 'raw server fields cannot invent the local setup subreason');
});
