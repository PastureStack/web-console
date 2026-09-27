import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewTemplateRoute from 'ui/settings/projects/new-template/route';

module('Unit | Route | settings projects new-template');

test('a new private template keeps Default stacks but not its catalog identity', async function(assert) {
  let stacks = [{name: 'orchestration', launchConfig: {imageUuid: 'docker:test'}}];
  let original = EmberObject.create({name: 'cattle', externalId: 'catalog-default',
    created: '2026-09-01T00:00:00Z', state: 'active', id: '1pt1', stacks});
  let createdPayload;
  let route = NewTemplateRoute.create({
    catalog: {fetchTemplates() { return resolve([]); }},
    userStore: {createRecord(payload) { createdPayload = payload; return payload; }},
  });
  route.modelFor = () => ({projectTemplates: [original]});
  let model = await route.model();

  assert.strictEqual(model.projectTemplate, createdPayload);
  assert.deepEqual(Object.keys(createdPayload).sort(), [
    'description', 'externalId', 'isPublic', 'name', 'stacks', 'type',
  ], 'the new resource contains only editable fields');
  assert.strictEqual(createdPayload.externalId, null, 'no inherited catalog ID');
  assert.strictEqual(createdPayload.isPublic, false);
  assert.strictEqual(createdPayload.name, '');
  assert.strictEqual(createdPayload.description, '');
  assert.deepEqual(createdPayload.stacks, stacks);
  assert.notStrictEqual(createdPayload.stacks, stacks, 'stack content is copied');
  assert.notStrictEqual(createdPayload.stacks[0], stacks[0], 'nested content is copied');
  createdPayload.stacks[0].launchConfig.imageUuid = 'docker:changed';
  assert.strictEqual(stacks[0].launchConfig.imageUuid, 'docker:test',
    'editing the new template does not mutate Default');
  run(() => route.destroy());
});
