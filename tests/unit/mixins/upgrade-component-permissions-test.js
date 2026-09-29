import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import UpgradeComponent from 'ui/mixins/upgrade-component';

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
