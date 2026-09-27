import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import NewTemplateRoute from 'ui/settings/projects/new-template/route';

module('Unit | Route | settings projects new-template');

test('a new private template keeps Default stacks but not its catalog identity', async function(assert) {
  let original = EmberObject.create({name: 'cattle', externalId: 'catalog-default'});
  let copy = {name: 'cattle', externalId: 'catalog-default', isPublic: true,
    description: 'Default catalog template', stacks: [{name: 'orchestration'}]};

  original.cloneForNew = () => copy;
  let route = NewTemplateRoute.create({
    catalog: {fetchTemplates() { return resolve([]); }},
  });
  route.modelFor = () => ({projectTemplates: [original]});
  let model = await route.model();

  assert.strictEqual(model.projectTemplate, copy);
  assert.strictEqual(copy.externalId, null, 'the new resource has no inherited catalog ID');
  assert.strictEqual(copy.isPublic, false);
  assert.strictEqual(copy.name, '');
  assert.strictEqual(copy.description, '');
  assert.deepEqual(copy.stacks, [{name: 'orchestration'}]);
  run(() => route.destroy());
});
