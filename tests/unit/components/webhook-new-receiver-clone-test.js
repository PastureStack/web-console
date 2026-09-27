import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';

import NewReceiver from 'ui/components/webhook/new-receiver/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | webhook new-receiver clone');

test('a cloned scaleHost receiver drops every inactive driver configuration', function(assert) {
  let selected = EmberObject.create({type: 'scaleHost', action: 'up', amount: 1});
  let model = EmberObject.create({
    type: 'receiver', driver: 'scaleHost', scaleHostConfig: selected,
    scaleServiceConfig: {type: 'scaleService'},
    serviceUpgradeConfig: {type: 'serviceUpgrade'},
    forwardPostConfig: {type: 'forwardPost'},
  });
  let component;

  run(() => {
    component = createOwned(NewReceiver, {
      renderer: inertRenderer(), model,
      projects: EmberObject.create({}),
      webhookStore: {createRecord(payload) { return payload; }},
    }, 'component');
  });

  assert.strictEqual(model.get('scaleHostConfig'), selected,
    'the selected driver configuration is kept');
  ['scaleServiceConfig', 'serviceUpgradeConfig', 'forwardPostConfig'].forEach((key) => {
    assert.strictEqual(model.get(key), null, `${key} cannot enter the new POST body`);
  });
  destroyOwned(component);
});
