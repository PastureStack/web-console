import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';

module('Unit | Mixin | cattle transitioning resource clone');

test('new-resource copies omit top-level server identity and lifecycle fields', function(assert) {
  let source = {
    id: '1pt1',
    actionLinks: {remove: '/remove'},
    links: {self: '/self'},
    uuid: 'existing-uuid',
    created: '2026-09-27T00:00:00Z',
    createdTS: 1790467200000,
    removed: null,
    state: 'active',
    transitioning: 'no',
    transitioningMessage: 'old operation',
    transitioningProgress: 75,
    type: 'projectTemplate',
    name: 'Editable copy',
    description: 'Keep user settings',
    stacks: [{name: 'orchestration', answers: {network: 'private'}}],
  };
  let Subject = EmberObject.extend(CattleTransitioningResource, {
    clone() { return {...this.get('source')}; },
    serialize() { return {...this.get('source')}; },
  });
  let subject = Subject.create({source});
  let excluded = [
    'id', 'actionLinks', 'links', 'uuid', 'created', 'createdTS', 'removed',
    'state', 'transitioning', 'transitioningMessage', 'transitioningProgress',
  ];

  ['cloneForNew', 'serializeForNew'].forEach((method) => {
    let copy = subject[method]();

    excluded.forEach((field) => {
      assert.notOk(Object.prototype.hasOwnProperty.call(copy, field), `${method} omits ${field}`);
    });
    assert.strictEqual(copy.type, 'projectTemplate', `${method} keeps the resource type`);
    assert.strictEqual(copy.name, 'Editable copy', `${method} keeps the editable name`);
    assert.strictEqual(copy.description, 'Keep user settings', `${method} keeps the editable description`);
    assert.deepEqual(copy.stacks, source.stacks, `${method} keeps nested user settings`);
  });

  assert.strictEqual(source.id, '1pt1', 'the source identity remains intact');
  assert.strictEqual(source.state, 'active', 'the source lifecycle remains intact');
  subject.destroy();
});
