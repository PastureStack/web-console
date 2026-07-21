import { module, test } from 'qunit';

import { displayOrchestrationName } from 'ui/utils/orchestration-name';

module('Unit | Utility | orchestration name');

test('it uses the PastureStack component name for the compatibility engine', function(assert) {
  assert.equal(displayOrchestrationName('cattle'), 'PastureStack Orchestration Engine');
  assert.equal(displayOrchestrationName('CATTLE'), 'PastureStack Orchestration Engine');
});

test('it preserves other orchestration names', function(assert) {
  assert.equal(displayOrchestrationName('kubernetes'), 'Kubernetes');
  assert.equal(displayOrchestrationName(''), '');
});
