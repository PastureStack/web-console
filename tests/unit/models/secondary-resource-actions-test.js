import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';

import Secret from 'ui/models/secret';
import Certificate from 'ui/models/certificate';
import Registry from 'ui/models/registry';

const resources = [
  ['certificate', Certificate],
  ['registry', Registry],
];

module('Unit | Model | secondary resource actions');

resources.forEach(([name, Model]) => {
  test(`${name} Edit and Remove visibility follows resource action links`, function(assert) {
    let resource = Model.create({actionLinks: {}});
    let enabled = (action) => resource.get('availableActions').findBy('action', action).enabled;

    assert.false(enabled('edit'), 'Edit is hidden without an update action link');
    assert.false(enabled('promptDelete'), 'Remove is hidden without a remove action link');

    resource.set('actionLinks', {update: '/update'});
    assert.true(enabled('edit'), 'an update action link enables Edit');
    assert.false(enabled('promptDelete'), 'update alone does not enable Remove');

    resource.set('actionLinks', {remove: '/remove'});
    assert.false(enabled('edit'), 'remove alone does not enable Edit');
    assert.true(enabled('promptDelete'), 'a remove action link enables Remove');

    resource.destroy();
  });
});

test('Secret Edit needs an active resource with PUT and a self link; Remove follows its action link', function(assert) {
  let schema = EmberObject.create({resourceMethods: A(['GET', 'PUT', 'DELETE'])});
  let store = EmberObject.create({
    getById(type, id) {
      assert.deepEqual([type, id], ['schema', 'secret']);
      return schema;
    },
  });
  let secret = Secret.create({
    type: 'secret',
    id: 'secret-1',
    state: 'active',
    store,
    links: {self: '/v1/secrets/secret-1'},
    actionLinks: {remove: '/v1/secrets/secret-1?action=remove'},
  });
  let enabled = (action) => secret.get('availableActions').findBy('action', action).enabled;

  assert.true(enabled('edit'), 'PUT and self enable Edit without an update action link');
  assert.true(enabled('promptDelete'), 'Remove still follows its remove action link');

  secret.set('state', 'removing');
  assert.false(enabled('edit'), 'a non-active Secret cannot be edited');
  assert.true(enabled('promptDelete'), 'state does not replace the remove action link');

  secret.set('state', 'active');
  schema.set('resourceMethods', A(['GET', 'DELETE']));
  secret.set('actionLinks', {update: '/v1/secrets/secret-1?action=update'});
  assert.false(enabled('edit'), 'an update action link cannot override read-only schema methods');
  assert.false(enabled('promptDelete'), 'DELETE alone does not enable Remove');

  schema.set('resourceMethods', A(['GET', 'PUT', 'DELETE']));
  secret.set('links', {});
  assert.false(enabled('edit'), 'a Secret without a self link cannot be edited');
  secret.set('links', {self: '/v1/secrets/secret-1'});
  assert.true(enabled('edit'), 'PUT and self enable Edit independently of remove');
  assert.false(enabled('promptDelete'), 'the absent remove action link keeps Remove hidden');

  secret.destroy();
});
