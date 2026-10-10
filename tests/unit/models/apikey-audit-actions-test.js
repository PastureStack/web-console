import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import ApiKey from 'ui/models/apikey';
import RestrictedApiKey from 'ui/models/apikeyrestricted';

module('Unit | Model | API key audit actions');

function key(Model, supported, transitions) {
  let schema = EmberObject.create({resourceFields: supported ? {apiKeyPolicy: {}} : {}});
  return Model.create({
    id: 'selected-key', links: {self: '/v2-beta/apikeys/selected-key'}, actionLinks: {},
    userStore: EmberObject.create({generation: 1, getById(type, id) {
      if (type !== 'schema' || id !== 'apikey') { throw new Error('UnexpectedAuditSchema'); }
      return schema;
    }}),
    router: EmberObject.create({transitionTo(...args) { transitions.push(args); return 'selected-audit'; }}),
  });
}

for (let [type, Model] of [['account', ApiKey], ['restricted', RestrictedApiKey]]) {
  test(`${type} Key exposes one read-only audit menu item without granting mutation actions`, function(assert) {
    let transitions = [];
    let model = key(Model, true, transitions);
    let actions = model.get('availableActions');
    let audit = actions.filterBy('action', 'audit');
    assert.strictEqual(audit.length, 1);
    assert.true(audit[0].enabled);
    assert.strictEqual(audit[0].label, 'apiKeyAudit.title', 'existing translated audit title');
    assert.false(actions.findBy('action', 'edit').enabled, 'audit does not enable editing');
    assert.false(actions.findBy('action', 'promptDelete').enabled, 'audit does not enable deletion');
    model.send('audit');
    assert.deepEqual(transitions, [['authenticated.project.api.keys', {queryParams: {targetKey: 'selected-key'}}]],
      'the selected Key opens in the existing viewer-scoped audit page');
    model.destroy();
  });
}

test('legacy capability and missing self link do not expose or dispatch audit', function(assert) {
  let transitions = [];
  let legacy = key(ApiKey, false, transitions);
  assert.false(legacy.get('availableActions').findBy('action', 'audit').enabled);
  legacy.send('audit');
  let model = key(ApiKey, true, transitions);
  model.set('links', {});
  assert.false(model.get('availableActions').findBy('action', 'audit').enabled);
  model.send('audit');
  assert.deepEqual(transitions, [], 'stale menu cannot dispatch after capability or visibility loss');
  legacy.destroy();
  model.destroy();
});
