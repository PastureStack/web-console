import { module, test } from 'qunit';
import { COMMANDS } from 'ui/utils/ai-command-contract';
import { RESOURCE_CHANGES } from 'ui/utils/ai-resource-registry';
import { resourceReviewLabels } from 'ui/utils/ai-resource-review-labels';

module('Unit | Utils | Project metadata human review');

test('selected project review uses existing translated type and keeps literal metadata, null and empty distinct', function(assert) {
  const plan = {resourceType: 'project', operation: 'update_metadata', displayDiff: [
    {field: 'name', before: 'original', after: '<script>فارسی & 環境</script>'},
    {field: 'description', before: null, after: ''},
  ]};
  const unchanged = JSON.stringify(plan), labels = resourceReviewLabels(plan, key => key);
  assert.strictEqual(labels.resourceTypeLabel, 'apiKeyAccess.selector.types.project');
  assert.strictEqual(labels.operationLabel, 'generic.edit');
  assert.deepEqual(labels.displayChanges.map(change => change.fieldLabel), ['generic.name', 'generic.description']);
  assert.strictEqual(labels.displayChanges[0].after, plan.displayDiff[0].after, 'shared literal diff is preserved for escaped normal UI rendering');
  assert.notStrictEqual(labels.displayChanges[1].before, labels.displayChanges[1].after, 'null and empty description keep distinct review labels');
  assert.strictEqual(JSON.stringify(plan), unchanged, 'review does not mutate the immutable server plan');
  assert.false(labels.createsStopped, 'metadata review cannot imply a lifecycle operation');
});

test('project collaboration contract stays within twelve tools and one human-approved metadata operation', function(assert) {
  assert.strictEqual(COMMANDS.length, 12);
  assert.deepEqual(Object.keys(RESOURCE_CHANGES.project), ['update_metadata', 'switch_context', 'set_default']);
  assert.deepEqual(Object.entries(RESOURCE_CHANGES.project).filter(([, descriptor]) => descriptor.execution === 'native-wire').map(([operation]) => operation), ['update_metadata']);
  for (const operation of ['switch_context', 'set_default']) {
    assert.strictEqual(RESOURCE_CHANGES.project[operation].execution, 'browser-human-confirmation');
    assert.strictEqual(RESOURCE_CHANGES.project[operation].wire, null);
    assert.strictEqual(RESOURCE_CHANGES.project[operation].modelApply, 'needs_user');
    assert.deepEqual(RESOURCE_CHANGES.project[operation].fields, []);
  }
  assert.deepEqual(RESOURCE_CHANGES.project.update_metadata.fields, ['name', 'description']);
  const preview = COMMANDS.find(command => command.name === 'preview_resource_change');
  assert.true(preview.inputSchema.properties.resourceType.enum.includes('project'));
  assert.true(preview.description.includes('currently selected environment'));
  assert.true(preview.description.includes('switch environments normally'));
  assert.true(preview.description.includes('A human must approve the exact server plan before apply'));
  assert.false(COMMANDS.some(command => /approve|switch.*project|http|request/.test(command.name)), 'no model approval, context-switch or arbitrary HTTP tool');
});
