import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import UpgradeComponent from 'ui/mixins/upgrade-component';
import { parseExternalId } from 'ui/utils/parse-externalid';
import { resolve } from 'rsvp';
import { settled } from '@ember/test-helpers';

module('Unit | Mixin | upgrade component permissions');

test('upgrade and finish use their own instance action links', function(assert) {
  let model = EmberObject.create({state: 'active', actionLinks: {}});
  let subject = EmberObject.extend(UpgradeComponent).create({
    model,
    intl: EmberObject.create(),
    catalog: EmberObject.create(),
    userStore: EmberObject.create(),
  });

  subject.set('upgradeStatus', 'available');
  assert.false(subject.get('canApplyUpgrade'), 'create or update schema does not imply upgrade');
  assert.strictEqual(subject.get('color'), 'btn-disabled');

  subject.set('upgradeStatus', 'none');
  assert.strictEqual(subject.get('color'), 'hide', 'stacks without a catalog upgrade do not show a disabled button');
  subject.set('upgradeStatus', 'available');

  model.set('actionLinks.upgrade', '/upgrade');
  assert.true(subject.get('canApplyUpgrade'), 'instance upgrade link enables upgrade');

  subject.set('upgradeStatus', 'upgraded');
  assert.false(subject.get('canApplyUpgrade'), 'upgrade link does not imply finish');
  model.set('actionLinks.finishupgrade', '/finishupgrade');
  assert.true(subject.get('canApplyUpgrade'), 'finish requires its own link');

  run(() => subject.destroy());
});


test('ordinary Compose active and upgraded never look up a Catalog and keep native finish permission', async function(assert) {
  for (let externalId of [null, '']) {
    for (let state of ['active', 'upgraded']) {
      let calls = [];
      let model = EmberObject.create({state, externalId, externalIdInfo: parseExternalId(externalId), actionLinks: {finishupgrade: '/finish'}});
      let subject = EmberObject.extend(UpgradeComponent).create({
        model,
        intl: EmberObject.create(),
        userStore: EmberObject.create(),
        catalog: EmberObject.create({fetchTemplate(id, upgrade) { calls.push([id, upgrade]); return resolve({}); }}),
      });
      run(() => subject.updateStatus());
      await settled();
      assert.deepEqual(calls, [], 'ordinary Stack does not request templateversions/null or a fabricated template');
      assert.strictEqual(subject.get('upgradeStatus'), state === 'upgraded' ? 'upgraded' : 'none');
      assert.strictEqual(subject.get('canApplyUpgrade'), state === 'upgraded', 'upgraded retains its exact finish action');
      run(() => subject.destroy());
    }
  }
});

test('valid Catalog upgraded and available states retain the existing queue and lookups', async function(assert) {
  for (let state of ['active', 'upgraded']) {
    let info = parseExternalId('catalog://library:test:1');
    let calls = [];
    let subject = EmberObject.extend(UpgradeComponent).create({
      model: EmberObject.create({state, externalIdInfo: info, actionLinks: {upgrade: '/upgrade', finishupgrade: '/finish'}}),
      intl: EmberObject.create(),
      userStore: EmberObject.create(),
      catalog: EmberObject.create({
        fetchTemplate(id, upgrade) {
          calls.push([id, upgrade]);
          return resolve(upgrade ? {upgradeVersionLinks: {'2': '/versions/2'}} : {versionLinks: {'1': '/versions/1'}});
        },
      }),
    });
    let fetched = new Promise((done) => subject.addObserver('upgradeInfo', () => done()));
    // init already queued this lookup; observe that real lifecycle once.
    if (state === 'upgraded') {
      assert.strictEqual(subject.get('upgradeStatus'), 'upgraded', 'native finish remains visible immediately');
    }
    await fetched;
    await settled();
    assert.deepEqual(calls, [[info.id, true], [info.templateId, false]], 'the original Catalog queue fetches both exact resources');
    assert.strictEqual(subject.get('upgradeStatus'), state === 'upgraded' ? 'upgraded' : 'available');
    assert.true(subject.get('canApplyUpgrade'), 'the original native instance action permission remains required');
    run(() => subject.destroy());
  }
});
