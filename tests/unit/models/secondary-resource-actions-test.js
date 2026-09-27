import { module, test } from 'qunit';

import Secret from 'ui/models/secret';
import Certificate from 'ui/models/certificate';
import Registry from 'ui/models/registry';

const resources = [
  ['secret', Secret],
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
